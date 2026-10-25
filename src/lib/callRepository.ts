import { CallRecord, DashboardMetrics } from '../types';
import { STORAGE_KEY_CALLS } from '../config/defaultConfig';
import {
  isSupabaseConfigured,
  saveCallToSupabase,
  fetchCallsFromSupabase,
  uploadRecordingToSupabase,
  deleteCallFromSupabase,
} from './supabase';

const DB_NAME = 'SalesPilotAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Open IndexedDB for audio blobs
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeAudioBlobLocally(callId: string, blob: Blob): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, callId);
    return await new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('Could not store audio blob in IndexedDB:', err);
    return false;
  }
}

export async function getLocalAudioBlob(callId: string): Promise<Blob | null> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(callId);
    return new Promise((resolve) => {
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); resolve(null); };
    });
  } catch (err) {
    return null;
  }
}

// Exact IDs from the retired demo dataset; preserve all real call records.
const LEGACY_DEMO_CALL_IDS = new Set([
  'seed-call-1',
  'seed-call-2',
  'seed-call-3',
  'seed-call-4',
  'seed-call-5',
]);

const DELETED_CALLS_KEY = `${STORAGE_KEY_CALLS}_deleted`;
function readLocalCalls(): CallRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_CALLS) || '[]');
    if (!Array.isArray(parsed)) return [];
    const calls = parsed.filter((call) => call && typeof call.id === 'string' && !LEGACY_DEMO_CALL_IDS.has(call.id));
    if (calls.length !== parsed.length) localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(calls));
    return calls;
  } catch { return []; }
}
function readDeletedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_CALLS_KEY) || '[]')); }
  catch { return new Set(); }
}
async function backendRequest(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Call server is unavailable.');
  }
  return response.json();
}

export async function getAllCalls(): Promise<CallRecord[]> {
  const localCalls = readLocalCalls();
  const [remote, backend] = await Promise.allSettled([
    isSupabaseConfigured() ? fetchCallsFromSupabase() : Promise.resolve(null),
    backendRequest('/api/calls'),
  ]);
  const remoteCalls = remote.status === 'fulfilled' && Array.isArray(remote.value) ? remote.value : [];
  const backendCalls = backend.status === 'fulfilled' && Array.isArray(backend.value) ? backend.value : [];
  const deleted = readDeletedIds();
  const merged = new Map<string, CallRecord>();
  for (const call of [...backendCalls, ...remoteCalls, ...localCalls]) {
    if (call && typeof call.id === 'string' && !LEGACY_DEMO_CALL_IDS.has(call.id) && !deleted.has(call.id)) {
      merged.set(call.id, call);
    }
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function saveCall(call: CallRecord, audioBlob?: Blob): Promise<string[]> {
  const warnings: string[] = [];
  if (audioBlob?.size && (!call.recordingConsent || !call.recordingConsentAt)) {
    throw new Error('A recording cannot be saved without recorded consent.');
  }
  let audioStoredLocally = false;
  if (audioBlob?.size) {
    audioStoredLocally = await storeAudioBlobLocally(call.id, audioBlob);
    if (audioStoredLocally) call.recordingBlobId = call.id;
  }
  const persistLocal = () => {
    if (typeof window === 'undefined') return false;
    try {
      const existing = readLocalCalls();
      localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify([call, ...existing.filter((item) => item.id !== call.id)]));
      return true;
    } catch { return false; }
  };
  let localSaved = persistLocal();
  if (audioBlob?.size) {
    if (isSupabaseConfigured()) {
      call.recordingUrl = await uploadRecordingToSupabase(audioBlob, call.id) || undefined;
    }
    // Save only the actual MediaRecorder blob. No substitute audio is generated.
    try {
      const bytes = new Uint8Array(await audioBlob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const result = await backendRequest('/api/recordings/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.id, audioBase64: btoa(binary), mimeType: audioBlob.type,
          recordingConsent: call.recordingConsent, recordingConsentAt: call.recordingConsentAt }),
      });
      call.recordingUrl ||= result.url;
    } catch { /* IndexedDB or Supabase can still retain the actual recording. */ }
    if (!audioStoredLocally && !call.recordingUrl) warnings.push('Recording storage failed. Download the recording from this screen before leaving.');
  }
  localSaved = persistLocal() || localSaved;
  const [remote, backend] = await Promise.allSettled([
    isSupabaseConfigured() ? saveCallToSupabase(call) : Promise.resolve(false),
    backendRequest('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(call) }),
  ]);
  const remoteSaved = remote.status === 'fulfilled' && remote.value;
  const backendSaved = backend.status === 'fulfilled';
  if (!localSaved && !remoteSaved && !backendSaved) throw new Error('Call storage failed. Keep this screen open and download the recording.');
  if (isSupabaseConfigured() && !remoteSaved) warnings.push('Supabase sync failed; the call was saved to available local storage. Check the schema and connection.');
  return warnings;
}

export async function deleteCall(id: string): Promise<void> {
  // Retain a deletion marker so an unavailable remote store cannot resurrect this call.
  const deleted = readDeletedIds();
  deleted.add(id);
  localStorage.setItem(DELETED_CALLS_KEY, JSON.stringify([...deleted]));
  localStorage.setItem(STORAGE_KEY_CALLS, JSON.stringify(readLocalCalls().filter((call) => call.id !== id)));
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  } catch { /* Some browsers have no IndexedDB. */ }
  await Promise.allSettled([
    isSupabaseConfigured() ? deleteCallFromSupabase(id) : Promise.resolve(),
    backendRequest(`/api/calls/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  ]);
}

export function computeDashboardMetrics(calls: CallRecord[]): DashboardMetrics {
  const totalCalls = calls.length;
  let interestedCustomers = 0;
  let demoRequests = 0;
  let convertedCustomers = 0;
  let followUpRequired = 0;
  let notInterested = 0;
  let noResponse = 0;
  let unclassified = 0;

  for (const call of calls) {
    switch (call.salesStatus) {
      case 'Converted':
        convertedCustomers++;
        break;
      case 'Demo Requested':
        demoRequests++;
        break;
      case 'Interested':
        interestedCustomers++;
        break;
      case 'Follow-up Required':
        followUpRequired++;
        break;
      case 'Not Interested':
        notInterested++;
        break;
      case 'Unclassified':
        unclassified++;
        break;
      case 'No Response':
        noResponse++;
        break;
    }
  }

  // Conversion rate = Converted / totalCalls * 100
  const conversionRate =
    totalCalls > 0 ? Math.round((convertedCustomers / totalCalls) * 100) : 0;

  return {
    totalCalls,
    interestedCustomers,
    demoRequests,
    convertedCustomers,
    followUpRequired,
    notInterested,
    noResponse,
    unclassified,
    conversionRate,
  };
}
