import type { CallSummary, ProductConfig } from '../types';

export const CLASSIFIED_STATUSES = [
  'Converted', 'Demo Requested', 'Interested', 'Follow-up Required', 'Not Interested', 'No Response',
] as const;

export function buildSalesInstruction(config: Partial<ProductConfig> = {}): string {
  return `You are ${config.agentName || 'Alex'}, a professional AI sales representative for ${config.productName || 'FlowCRM'}.
Product description: ${config.productDescription || 'No product description provided.'}
Verified features: ${(config.features || []).join('; ') || 'No features provided.'}
Preferred language: ${config.preferredLanguage || 'English'}.
Answer the customer's latest specific question first, using the conversation history for context.
Keep replies natural and concise (one to three short spoken sentences). Do not use markdown.
Never repeat your greeting, previous answer, or a generic sales pitch instead of answering a question.
Ask at most one relevant follow-up question only after answering. Do not keep proposing a demo.
Use only the supplied product facts. If pricing, integrations, security, discounts, or other details are not supplied, say you do not have verified information and offer to have a human confirm it.
You have no tools to book demos, complete purchases, send emails, connect people, or schedule follow-ups. Never claim or promise that you or a team member will perform those actions. Acknowledge requested actions as requests to include in the call summary and explain that a human must confirm them.
Respect refusals and requests for later contact. Do not pressure the customer.`;
}

export function buildChatContents(messages: Array<{ sender: string; text: string }>, userMessage: string) {
  const history = messages
    .filter((message) => ['ai', 'customer'].includes(message.sender) && typeof message.text === 'string' && message.text.trim())
    .map((message) => ({ role: message.sender === 'ai' ? 'model' : 'user', parts: [{ text: message.text.trim() }] }));
  const last = history.at(-1);
  // The browser may already have appended this utterance to its history.
  if (last?.role !== 'user' || last.parts[0].text !== userMessage.trim()) {
    history.push({ role: 'user', parts: [{ text: userMessage.trim() }] });
  }
  return history;
}

export function validateCallSummary(value: unknown): CallSummary {
  const summary = value as CallSummary;
  if (!summary || typeof summary.conversationSummary !== 'string' || !summary.conversationSummary.trim()
    || !CLASSIFIED_STATUSES.includes(summary.finalSalesStatus as any)
    || !['customerRequirements', 'customerObjections', 'recommendedNextSteps'].every((key) =>
      Array.isArray((summary as any)[key]) && (summary as any)[key].every((item: unknown) => typeof item === 'string'))) {
    throw new Error('AI returned an incomplete or invalid call summary.');
  }
  return { ...summary, analysisSource: 'ai' };
}

export function unavailableSummary(): CallSummary {
  return {
    conversationSummary: 'AI analysis is unavailable. Review the saved transcript and recording before assessing this call.',
    customerRequirements: [], customerObjections: [], recommendedNextSteps: [],
    finalSalesStatus: 'Unclassified', analysisSource: 'unavailable',
  };
}

export function noResponseSummary(): CallSummary {
  return {
    conversationSummary: 'No customer response was transcribed during this call.',
    customerRequirements: [], customerObjections: [], recommendedNextSteps: [],
    finalSalesStatus: 'No Response', leadScore: 0, analysisSource: 'empty',
  };
}
