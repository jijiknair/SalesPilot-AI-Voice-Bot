export type SalesStatus =
  | 'Converted'
  | 'Interested'
  | 'Follow-up Required'
  | 'Not Interested'
  | 'Demo Requested'
  | 'No Response'
  | 'Unclassified';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'customer';
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

export interface CallSummary {
  analysisSource?: 'ai' | 'unavailable' | 'empty';
  conversationSummary: string;
  customerRequirements: string[];
  customerObjections: string[];
  recommendedNextSteps: string[];
  finalSalesStatus: SalesStatus;
  leadScore?: number; // 0-100
  customerName?: string;
  companyName?: string;
}

export interface CallRecord {
  id: string;
  customerName: string;
  companyName?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  salesStatus: SalesStatus;
  summary: CallSummary;
  transcript: ChatMessage[];
  recordingConsent?: boolean;
  recordingConsentAt?: string;
  recordingUrl?: string;
  recordingBlobId?: string;
  recordingDuration?: number;
  productName: string;
  agentName: string;
  created_at?: string;
}

export interface ProductConfig {
  productName: string;
  productDescription: string;
  features: string[];
  agentName: string;
  greetingMessage: string;
  preferredLanguage: string;
  voiceName: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
}

export type CallAgentStatus =
  | 'Ready'
  | 'Connecting'
  | 'Listening'
  | 'Speaking'
  | 'Ended'
  | 'Error';

export interface DashboardMetrics {
  totalCalls: number;
  interestedCustomers: number;
  demoRequests: number;
  convertedCustomers: number;
  followUpRequired: number;
  notInterested: number;
  noResponse: number;
  unclassified: number;
  conversionRate: number; // percentage
}
