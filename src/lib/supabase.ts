import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CallRecord } from '../types';
import { STORAGE_KEY_SUPABASE } from '../config/defaultConfig';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window === 'undefined') {
    return {
      url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
      anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
    };
  }
  const stored = localStorage.getItem(STORAGE_KEY_SUPABASE);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored Supabase config', e);
    }
  }
  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(config));
  }
}

let clientInstance: SupabaseClient | null = null;
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  const key = `${config.url}_${config.anonKey}`;
  if (clientInstance && currentClientKey === key) {
    return clientInstance;
  }
  try {
    clientInstance = createClient(config.url, config.anonKey);
    currentClientKey = key;
    return clientInstance;
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export async function testSupabaseConnection(config?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const targetConfig = config || getSupabaseConfig();
    if (!targetConfig.url || !targetConfig.anonKey) {
      return { success: false, message: 'URL and Anon Key are required.' };
    }
    const testClient = createClient(targetConfig.url, targetConfig.anonKey);
    const { error } = await testClient.from('calls').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "public.calls" does not exist') || error.code === '42P01') {
        return {
          success: false,
          message: 'Connected to Supabase, but the "calls" table does not exist. Please run the provided SQL schema in Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Supabase query error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase and verified the "calls" table.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

export async function uploadRecordingToSupabase(blob: Blob, callId: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const fileName = `${callId}-${Date.now()}.${extension}`;
    const { data, error } = await client.storage
      .from('call-recordings')
      .upload(fileName, blob, {
        contentType: blob.type || 'audio/webm',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from('call-recordings')
      .getPublicUrl(data.path);

    return publicUrlData?.publicUrl || null;
  } catch (e) {
    console.warn('Failed to upload recording to Supabase', e);
    return null;
  }
}

export async function saveCallToSupabase(call: CallRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('calls').upsert({
      id: call.id,
      customer_name: call.customerName,
      company_name: call.companyName || null,
      started_at: call.startedAt,
      ended_at: call.endedAt,
      duration_seconds: call.durationSeconds,
      sales_status: call.salesStatus,
      summary: call.summary,
      transcript: call.transcript,
      recording_url: call.recordingUrl || null,
      recording_consent: call.recordingConsent || false,
      recording_consent_at: call.recordingConsentAt || null,
      recording_duration: call.recordingDuration || null,
      product_name: call.productName,
      agent_name: call.agentName,
    });
    if (error) {
      console.warn('Failed to insert call to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Supabase insert exception:', e);
    return false;
  }
}

export async function fetchCallsFromSupabase(): Promise<CallRecord[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('calls')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch from Supabase:', error.message);
      return null;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      customerName: row.customer_name || 'Prospect',
      companyName: row.company_name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds || 0,
      salesStatus: row.sales_status,
      summary: row.summary || {},
      transcript: row.transcript || [],
      recordingUrl: row.recording_url,
      recordingConsent: row.recording_consent,
      recordingConsentAt: row.recording_consent_at,
      recordingDuration: row.recording_duration,
      productName: row.product_name || 'FlowCRM',
      agentName: row.agent_name || 'Alex',
      created_at: row.created_at,
    }));
  } catch (e) {
    console.warn('Supabase fetch exception:', e);
    return null;
  }
}

export async function deleteCallFromSupabase(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { data } = await client.from('calls').select('recording_url').eq('id', id).maybeSingle();
  const { error } = await client.from('calls').delete().eq('id', id);
  if (error) throw error;
  const prefix = '/storage/v1/object/public/call-recordings/';
  if (data?.recording_url?.includes(prefix)) {
    const objectPath = decodeURIComponent(new URL(data.recording_url).pathname.split(prefix)[1]);
    await client.storage.from('call-recordings').remove([objectPath]);
  }
}
