import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';

let child: ChildProcess;
let directory: string;
let base: string;
let output = '';
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'salespilot-api-'));
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  base = `http://127.0.0.1:${port}`;
  // Use an isolated store and no API key: never write diagnostic records into user history.
  child = spawn(process.execPath, ['--use-system-ca', '--import', 'tsx', 'server.ts', '--production'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), CALL_DATA_DIR: directory, GEMINI_API_KEY: '', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stdout?.on('data', (data) => { output += String(data); });
  child.stderr?.on('data', (data) => { output += String(data); });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Test server failed to start: ' + output);
});
after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function post(endpoint: string, body: unknown) {
  return fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
test('AI outage returns 503 instead of a canned sales reply or invented summary', async () => {
  const chat = await post('/api/gemini/chat-turn', { messages: [], userMessage: 'What is the price?' });
  assert.equal(chat.status, 503);
  const data = await chat.json();
  assert.ok(data.error);
  assert.equal(data.reply, undefined);
  const evidence = JSON.parse(await readFile('artifacts/api-verification.json', 'utf8'));
  const summary = await post('/api/gemini/summarize', { transcript: evidence.diagnosticConversation });
  assert.equal(summary.status, 503);
  const analysis = await summary.json();
  assert.equal(analysis.finalSalesStatus, undefined);
  assert.equal(analysis.customerRequirements, undefined);
});
test('silent call gets No Response; malformed inputs and absent recordings fail clearly', async () => {
  const response = await post('/api/gemini/summarize', { transcript: [] });
  assert.equal((await response.json()).finalSalesStatus, 'No Response');
  assert.equal((await post('/api/gemini/chat-turn', { userMessage: '' })).status, 400);
  assert.equal((await post('/api/gemini/summarize', { transcript: [{ sender: 'unknown' }] })).status, 400);
  assert.equal((await fetch(base + '/api/recordings/does-not-exist.webm')).status, 404);
  assert.equal((await post('/api/recordings/upload', {})).status, 400);
});
test('real diagnostic text exchange persists, reloads, and deletes in an isolated history store', async () => {
  const evidence = JSON.parse(await readFile('artifacts/api-verification.json', 'utf8'));
  const summary = evidence.checks.find((check: any) => check.feature === 'summary').data;
  const now = new Date().toISOString();
  const id = randomUUID();
  const record = { id, customerName: 'API diagnostic', startedAt: now, endedAt: now, durationSeconds: 0,
    salesStatus: summary.finalSalesStatus, summary, transcript: evidence.diagnosticConversation,
    productName: 'FlowCRM', agentName: 'Alex', recordingConsent: false };
  assert.equal((await post('/api/calls', record)).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/calls')).json(), [record]);
  const saved = JSON.parse(await readFile(path.join(directory, 'calls.json'), 'utf8'));
  assert.equal(saved[0].id, id);
  assert.equal(saved[0].recordingUrl, undefined);
  assert.equal((await fetch(base + '/api/calls/' + id, { method: 'DELETE' })).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/calls')).json(), []);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'calls.json'), 'utf8')), []);
});

test('repository merges browser metadata with the real test server and persists deletion across reload', async () => {
  const { saveCall, getAllCalls, deleteCall, computeDashboardMetrics } = await import('../src/lib/callRepository');
  const { STORAGE_KEY_CALLS } = await import('../src/config/defaultConfig');
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }, configurable: true });
  globalThis.fetch = (input, init) => originalFetch(typeof input === 'string' && input.startsWith('/') ? base + input : input, init);
  try {
    assert.deepEqual(await getAllCalls(), []);
    assert.ok(Object.values(computeDashboardMetrics([])).every((value) => value === 0));
    const evidence = JSON.parse(await readFile('artifacts/api-verification.json', 'utf8'));
    const summary = evidence.checks.find((item: any) => item.feature === 'summary').data;
    const now = new Date().toISOString();
    const record = { id: randomUUID(), customerName: 'API diagnostic', startedAt: now, endedAt: now,
      durationSeconds: 0, salesStatus: summary.finalSalesStatus, summary, transcript: evidence.diagnosticConversation,
      productName: 'FlowCRM', agentName: 'Alex', recordingConsent: false };
    storage.set(STORAGE_KEY_CALLS, JSON.stringify([{ id: 'seed-call-1' }, record]));
    assert.deepEqual(await getAllCalls(), [record]);
    assert.deepEqual(JSON.parse(storage.get(STORAGE_KEY_CALLS)!), [record]);
    assert.deepEqual(await saveCall(record), []);
    storage.delete(STORAGE_KEY_CALLS);
    assert.deepEqual(await getAllCalls(), [record]);
    await deleteCall(record.id);
    assert.deepEqual(await getAllCalls(), []);
    assert.deepEqual(await (await originalFetch(base + '/api/calls')).json(), []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
