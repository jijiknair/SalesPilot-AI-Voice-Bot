import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { MakeCall } from './pages/MakeCall';
import { CallHistory } from './pages/CallHistory';
import { Settings } from './pages/Settings';
import { CallRecord, ProductConfig } from './types';
import { DEFAULT_PRODUCT_CONFIG, STORAGE_KEY_CONFIG } from './config/defaultConfig';
import { getAllCalls, deleteCall } from './lib/callRepository';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'make-call' | 'call-history' | 'settings'>('dashboard');
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [productConfig, setProductConfig] = useState<ProductConfig>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return DEFAULT_PRODUCT_CONFIG;
  });

  // Load calls on startup
  useEffect(() => {
    let mounted = true;
    getAllCalls().then((loaded) => {
      if (mounted) setCalls(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCallSaved = (newCall: CallRecord) => {
    setCalls((prev) => [newCall, ...prev.filter((c) => c.id !== newCall.id)]);
  };

  const handleDeleteCall = async (id: string) => {
    try {
      await deleteCall(id);
      setCalls((prev) => prev.filter((call) => call.id !== id));
      setHistoryError(null);
    } catch (error: any) { setHistoryError(error.message || 'Could not delete the call.'); }
  };

  const handleViewCallDetails = (call: CallRecord) => {
    setSelectedCall(call);
    setCurrentTab('call-history');
  };

  const getPageTitleAndSubtitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Sales Intelligence Dashboard',
          subtitle: `Live metrics, conversion rates, and recent voice consultations for ${productConfig.productName}`,
        };
      case 'make-call':
        return {
          title: 'Make a Voice Call',
          subtitle: `Real-time two-way voice conversation with AI Sales Representative ${productConfig.agentName}`,
        };
      case 'call-history':
        return {
          title: 'Call History & Recordings',
          subtitle: 'Complete transcripts, automated summaries, and synchronized audio playback',
        };
      case 'settings':
        return {
          title: 'System & Product Settings',
          subtitle: `Configure ${productConfig.productName} product parameters, Supabase storage, and voice models`,
        };
    }
  };

  const { title, subtitle } = getPageTitleAndSubtitle();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Dark Navy Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isCallActive={isCallActive}
        productName={productConfig.productName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          title={title}
          subtitle={subtitle}
          isCallActive={isCallActive}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto bg-slate-50/70">
          {currentTab === 'dashboard' && (
            <Dashboard
              calls={calls}
              productName={productConfig.productName}
              agentName={productConfig.agentName}
              onStartCall={() => setCurrentTab('make-call')}
              onViewCallDetails={handleViewCallDetails}
              onNavigateToHistory={() => setCurrentTab('call-history')}
            />
          )}

          <div hidden={currentTab !== 'make-call'}>
            <MakeCall
              productConfig={productConfig}
              recordingConsent={recordingConsent}
              setRecordingConsent={setRecordingConsent}
              onCallSaved={handleCallSaved}
              onActiveChange={setIsCallActive}
            />
          </div>

          {historyError && <p role="alert" className="p-3 text-xs text-rose-700">{historyError}</p>}
          {currentTab === 'call-history' && (
            <CallHistory
              calls={calls}
              selectedCall={selectedCall}
              setSelectedCall={setSelectedCall}
              onDeleteCall={handleDeleteCall}
            />
          )}

          {currentTab === 'settings' && (
            <Settings
              productConfig={productConfig}
              setProductConfig={setProductConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}
