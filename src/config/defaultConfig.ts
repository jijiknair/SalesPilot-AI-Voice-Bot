import { ProductConfig } from '../types';

export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  productName: 'FlowCRM',
  productDescription:
    'FlowCRM is a cloud-based customer relationship management platform designed specifically for small and medium businesses to streamline sales pipelines, nurture leads, and accelerate revenue.',
  features: [
    'Customer and lead management with automated contact enrichment',
    'Visual drag-and-drop sales pipeline tracking',
    'Automated follow-up reminders and scheduled tasks',
    'Comprehensive customer interaction and communications history',
    'Real-time sales reporting dashboard and revenue forecasting',
    'Team collaboration with activity feeds and shared deal pipelines',
  ],
  agentName: 'Alex',
  greetingMessage:
    "Hello! I'm Alex, your AI sales assistant from FlowCRM. We help businesses manage customer leads and sales more efficiently. May I ask how you currently manage your customers and follow-ups?",
  preferredLanguage: 'English',
  voiceName: 'Zephyr',
};

export const STORAGE_KEY_CONFIG = 'salespilot_product_config';
export const STORAGE_KEY_CALLS = 'salespilot_call_history';
export const STORAGE_KEY_SUPABASE = 'salespilot_supabase_config';
