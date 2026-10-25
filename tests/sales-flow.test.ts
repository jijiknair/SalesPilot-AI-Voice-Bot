import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatContents, buildSalesInstruction, validateCallSummary, noResponseSummary, unavailableSummary, CLASSIFIED_STATUSES } from '../src/lib/salesConversation';
import { GeminiVoiceManager } from '../src/lib/geminiLiveClient';
import { ConversationAudioRecorder } from '../src/lib/audioRecorder';

test('current customer message appears once while earlier context is retained', () => {
  const messages = [{ sender: 'ai', text: 'Which feature would you like explained?' }, { sender: 'customer', text: 'Follow-up reminders' }];
  const contents = buildChatContents(messages, 'Follow-up reminders');
  assert.equal(contents.length, 2);
  assert.equal(contents[0].role, 'model');
  assert.equal(contents[1].parts[0].text, 'Follow-up reminders');
  assert.equal(messages.length, 2);
});
test('appends new utterances and preserves intentional questions repeated after an answer', () => {
  const history = [{ sender: 'customer', text: 'Pricing?' }, { sender: 'ai', text: 'Pricing is not available.' }];
  assert.equal(buildChatContents(history, 'Pricing?').length, 3);
  assert.equal(buildChatContents([], 'Hello').length, 1);
});
test('custom SaaS facts, agent, and language reach both modes through shared instructions', () => {
  const instruction = buildSalesInstruction({ productName: 'Inventory Cloud', productDescription: 'Inventory management', agentName: 'Maya', features: ['Stock alerts'], preferredLanguage: 'Telugu' });
  for (const text of ['Inventory Cloud', 'Inventory management', 'Maya', 'Stock alerts', 'Telugu', "latest specific question first"]) assert.ok(instruction.includes(text));
  assert.ok(!instruction.includes('FlowCRM'));
});
test('AI summary supports exactly the six assignment outcomes and validates every list', () => {
  assert.equal(CLASSIFIED_STATUSES.length, 6);
  for (const finalSalesStatus of CLASSIFIED_STATUSES) {
    const result = validateCallSummary({ ...noResponseSummary(), finalSalesStatus });
    assert.equal(result.finalSalesStatus, finalSalesStatus);
    assert.equal(result.analysisSource, 'ai');
  }
  assert.throws(() => validateCallSummary({ ...noResponseSummary(), finalSalesStatus: 'Maybe' }));
  assert.throws(() => validateCallSummary({ ...noResponseSummary(), customerRequirements: 'invented list' }));
  assert.throws(() => validateCallSummary({ ...noResponseSummary(), customerObjections: [42] }));
  assert.throws(() => validateCallSummary({}));
});
test('analysis failure neither invents requirements nor assigns a positive sales outcome', () => {
  const summary = unavailableSummary();
  assert.equal(summary.finalSalesStatus, 'Unclassified');
  assert.equal(summary.analysisSource, 'unavailable');
  assert.deepEqual(summary.customerRequirements, []);
  assert.deepEqual(summary.customerObjections, []);
  assert.deepEqual(summary.recommendedNextSteps, []);
});
test('no-response result does not invent contact tasks or customer needs', () => {
  const summary = noResponseSummary();
  assert.equal(summary.finalSalesStatus, 'No Response');
  assert.equal(summary.leadScore, 0);
  assert.deepEqual(summary.recommendedNextSteps, []);
});
test('recording consent is enforced before any microphone or recording access', async () => {
  const manager = new GeminiVoiceManager({ onStatusChange() {}, onUserMessage() {}, onAiMessage() {}, onAudioLevel() {} }, {} as any, new ConversationAudioRecorder());
  await assert.rejects(manager.startSession(false), /consent/);
});
test('ending a session with no media is idempotent and creates no placeholder audio', async () => {
  const manager = new GeminiVoiceManager({ onStatusChange() {}, onUserMessage() {}, onAiMessage() {}, onAudioLevel() {} }, {} as any, new ConversationAudioRecorder());
  const first = manager.endSession();
  assert.equal(manager.endSession(), first);
  assert.equal(await first, null);
});
