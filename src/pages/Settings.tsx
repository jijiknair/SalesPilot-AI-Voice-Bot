import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Database,
  Cloud,
} from 'lucide-react';
import { ProductConfig } from '../types';
import { DEFAULT_PRODUCT_CONFIG, STORAGE_KEY_CONFIG } from '../config/defaultConfig';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';

interface SettingsProps {
  productConfig: ProductConfig;
  setProductConfig: (config: ProductConfig) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  productConfig,
  setProductConfig,
}) => {
  const [form, setForm] = useState<ProductConfig>({ ...productConfig });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Supabase
  const [supabaseUrl, setSupabaseUrl] = useState(getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(getSupabaseConfig().anonKey);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  const handleSaveProductConfig = () => {
    setProductConfig(form);
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(form));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    setForm({ ...DEFAULT_PRODUCT_CONFIG });
    setProductConfig({ ...DEFAULT_PRODUCT_CONFIG });
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveSupabase = async () => {
    const config = { url: supabaseUrl.trim(), anonKey: supabaseAnonKey.trim() };
    saveSupabaseConfig(config);
    setTestingConnection(true);
    setTestResult(null);
    const res = await testSupabaseConnection(config);
    setTestResult(res);
    setTestingConnection(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Settings</h2>
          <p className="text-xs text-slate-500">Configure product parameters and cloud integrations</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSaveProductConfig}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* 1. SaaS Product & Agent Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          Product & Agent Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Product Name</label>
            <input
              type="text"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">AI Agent Name</label>
            <input
              type="text"
              value={form.agentName}
              onChange={(e) => setForm({ ...form, agentName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Product Description</label>
          <textarea
            rows={2}
            value={form.productDescription}
            onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Greeting Message</label>
          <textarea
            rows={2}
            value={form.greetingMessage}
            onChange={(e) => setForm({ ...form, greetingMessage: e.target.value })}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Voice Persona</label>
            <select
              value={form.voiceName}
              onChange={(e) => setForm({ ...form, voiceName: e.target.value as any })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
            >
              <option value="Zephyr">Zephyr (Default Warm)</option>
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Kore">Kore</option>
              <option value="Fenrir">Fenrir</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Language</label>
            <input
              type="text"
              value={form.preferredLanguage}
              onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Supabase Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            Supabase Cloud Database
          </h3>
          <span className="text-[11px] text-slate-400">Optional</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Project URL</label>
            <input
              type="text"
              placeholder="https://xxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Anon Public Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            onClick={handleSaveSupabase}
            disabled={testingConnection}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {testingConnection ? 'Testing...' : 'Save & Test Connection'}
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>

      {/* 3. Netlify Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <Cloud className="w-4 h-4 text-blue-600" />
          Netlify Deployment
        </h3>
        <p className="text-xs text-slate-500">
          Build command: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono">npm run build</code> • Publish directory: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono">dist</code>
        </p>
      </div>
    </div>
  );
};
