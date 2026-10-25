import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  Sparkles,
  Send,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Building,
  Target,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import {
  CallAgentStatus,
  ChatMessage,
  CallSummary,
  ProductConfig,
  CallRecord,
  SalesStatus,
} from '../types';
import { AgentAvatar } from '../components/AgentAvatar';
import { AudioWaveform } from '../components/AudioWaveform';
import { AudioPlayer } from '../components/AudioPlayer';
import { GeminiVoiceManager } from '../lib/geminiLiveClient';
import { ConversationAudioRecorder } from '../lib/audioRecorder';
import { saveCall } from '../lib/callRepository';
import { validateCallSummary, unavailableSummary } from '../lib/salesConversation';

interface MakeCallProps {
  productConfig: ProductConfig;
  recordingConsent: boolean;
  setRecordingConsent: (consent: boolean) => void;
  onCallSaved: (call: CallRecord) => void;
  onActiveChange: (active: boolean) => void;
}

export const MakeCall: React.FC<MakeCallProps> = ({
  productConfig,
  recordingConsent,
  setRecordingConsent,
  onCallSaved,
  onActiveChange,
}) => {
  // Call State
  const [sessionActive, setSessionActive] = useState(false);
  const sessionActiveRef = useRef(false);
  const endingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const startedAtRef = useRef<Date | null>(null);
  const callIdRef = useRef('');
  const callProductRef = useRef(productConfig);
  const [callStatus, setCallStatus] = useState<CallAgentStatus>('Ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Conversation & Transcription
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveUserSpeech, setLiveUserSpeech] = useState<string>('');
  const [liveAiSpeech, setLiveAiSpeech] = useState<string>('');
  const [textInputValue, setTextInputValue] = useState('');

  // Call End & Summary State
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string>('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  // References
  const voiceManagerRef = useRef<GeminiVoiceManager | null>(null);
  const recorderRef = useRef<ConversationAudioRecorder>(new ConversationAudioRecorder());
  const timerIntervalRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, liveUserSpeech, liveAiSpeech]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (voiceManagerRef.current) {
        voiceManagerRef.current.endSession().catch(() => {});
      }
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusBadge = (status: SalesStatus) => {
    switch (status) {
      case 'Converted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'Demo Requested':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'Interested':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'Follow-up Required':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'Not Interested':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      case 'Unclassified':
      case 'No Response':
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const commitMessage = (sender: 'ai' | 'customer', text: string) => {
    if (!text.trim()) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(), sender, text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
  };

  const handleStartCall = async () => {
    if (sessionActiveRef.current || endingRef.current) return;
    if (!recordingConsent) { setErrorMessage('Please check the recording consent box below.'); return; }
    sessionActiveRef.current = true;
    setSessionActive(true);
    onActiveChange(true);
    setCallStatus('Connecting');
    setErrorMessage(null);
    setCallSummary(null);
    setRecordedAudioBlob(null);
    messagesRef.current = [];
    setMessages([]);
    setLiveAiSpeech('');
    setLiveUserSpeech('');
    setIsMuted(false);
    setAudioLevel(0);
    setCallDuration(0);
    const callId = crypto.randomUUID();
    setCurrentCallId(callId);
    callIdRef.current = callId;
    callProductRef.current = productConfig;
    const started = new Date();
    startedAtRef.current = started;
    setCallStartTime(started);
    recorderRef.current = new ConversationAudioRecorder();
    const manager = new GeminiVoiceManager({
      onStatusChange: (status, error) => { setCallStatus(status); if (error) setErrorMessage(error); },
      onUserMessage: (text, final) => {
        if (final) { setLiveUserSpeech(''); commitMessage('customer', text); }
        else setLiveUserSpeech(text);
      },
      onAiMessage: (text, final) => {
        if (final) { setLiveAiSpeech(''); commitMessage('ai', text); }
        else setLiveAiSpeech(text);
      },
      onAudioLevel: setAudioLevel,
    }, productConfig, recorderRef.current);
    voiceManagerRef.current = manager;
    timerIntervalRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - started.getTime()) / 1000));
    }, 1000);
    try {
      await manager.startSession(recordingConsent);
    } catch (error: any) {
      if (endingRef.current || voiceManagerRef.current !== manager) return;
      sessionActiveRef.current = false;
      setSessionActive(false);
      onActiveChange(false);
      setCallStatus('Error');
      setErrorMessage(error.message || 'Could not start voice call.');
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const handleEndCall = async () => {
    if (!sessionActiveRef.current || endingRef.current) return;
    endingRef.current = true;
    sessionActiveRef.current = false;
    setSessionActive(false);
    setCallStatus('Ended');
    onActiveChange(false);
    setIsSummarizing(true);
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    const endedAt = new Date();
    const startedAt = startedAtRef.current || endedAt;
    const duration = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
    setCallDuration(duration);
    let audioBlob: Blob | null = null;
    try {
      audioBlob = await voiceManagerRef.current?.endSession() || null;
      if (!audioBlob?.size) audioBlob = null;
      setRecordedAudioBlob(audioBlob);
    } catch { setErrorMessage('Recording could not be finalized. The available transcript will still be saved.'); }
    // endSession flushes the final streamed fragments through callbacks before returning.
    const transcript = [...messagesRef.current];
    let summary: CallSummary = unavailableSummary();
    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, productConfig: callProductRef.current, durationSeconds: duration }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI analysis failed.');
      summary = validateCallSummary(data);
      if (data.analysisSource === 'empty') summary.analysisSource = 'empty';
    } catch (error: any) {
      setErrorMessage(`${error.message || 'AI analysis unavailable.'} Saving the call without a sales classification.`);
    }
    setCallSummary(summary);
    const call: CallRecord = {
      id: callIdRef.current || crypto.randomUUID(),
      customerName: summary.customerName || 'Prospect', companyName: summary.companyName || '',
      startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationSeconds: duration,
      salesStatus: summary.finalSalesStatus, summary, transcript,
      productName: callProductRef.current.productName, agentName: callProductRef.current.agentName,
      recordingConsent: true, recordingConsentAt: startedAt.toISOString(), recordingDuration: duration,
    };
    try {
      const warnings = await saveCall(call, audioBlob || undefined);
      onCallSaved(call);
      if (warnings.length) setErrorMessage(warnings.join(' '));
    } catch (error: any) {
      setErrorMessage(error.message || 'Call could not be saved. Keep this screen open to download the recording.');
    } finally {
      endingRef.current = false;
      setIsSummarizing(false);
      onActiveChange(false);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setMuted(nextMuted);
    }
  };

  const handleSendText = () => {
    if (!textInputValue.trim() || !voiceManagerRef.current || callStatus === 'Error' || callStatus === 'Connecting') return;
    voiceManagerRef.current.sendTextMessage(textInputValue);
    setTextInputValue('');
  };

  const isCallActive = sessionActive;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold text-rose-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Column Clean Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Voice Agent Alex */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              AI Voice Agent
            </span>
            <div className="flex items-center gap-1 font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{formatTimer(callDuration)}</span>
            </div>
          </div>

          {/* Avatar */}
          <div className="my-2">
            <AgentAvatar
              status={callStatus}
              agentName={productConfig.agentName}
              isSpeaking={callStatus === 'Speaking'}
              audioLevel={audioLevel}
            />
          </div>

          {/* Waveform */}
          <div className="w-full mt-2">
            <AudioWaveform
              analyser={voiceManagerRef.current?.getAnalyserNode() || null}
              isActive={isCallActive}
              status={callStatus}
              audioLevel={audioLevel}
            />
          </div>

          {/* Action Buttons */}
          <div className="w-full mt-5">
            {!isCallActive ? (
              <button
                onClick={handleStartCall}
                disabled={!recordingConsent || isSummarizing}
                className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                  recordingConsent && !isSummarizing
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>{isSummarizing ? 'Saving Call...' : 'Start Call'}</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={handleToggleMute}
                  className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMuted ? 'Muted' : 'Mute'}</span>
                </button>

                <button
                  onClick={handleEndCall}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </div>
            )}
          </div>

          {/* Recording Consent Checkbox */}
          <div className="w-full mt-4 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={recordingConsent}
                disabled={isCallActive}
                onChange={(e) => setRecordingConsent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
              />
              <span>Consent to call recording</span>
            </label>
          </div>
        </div>

        {/* Middle Column: Live Conversation */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 flex flex-col h-[650px] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">Live Conversation</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-blue-600 font-medium">● AI (Blue)</span>
              <span className="text-[11px] text-emerald-600 font-medium">● You (Green)</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/50"
          >
            {messages.length === 0 && !liveAiSpeech && !liveUserSpeech && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <p className="text-xs font-medium">Click "Start Call" to begin speaking with {productConfig.agentName}.</p>
              </div>
            )}

            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
                >
                  <span className="text-[10px] text-slate-400 mb-0.5 px-1 font-medium">
                    {isAi ? productConfig.agentName : 'You'} • {msg.timestamp}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      isAi
                        ? 'bg-blue-50 text-slate-900 border border-blue-200/80 rounded-tl-xs'
                        : 'bg-emerald-50 text-slate-900 border border-emerald-200/80 rounded-tr-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {liveAiSpeech && (
              <div className="flex flex-col items-start animate-pulse">
                <span className="text-[10px] text-indigo-500 mb-0.5 px-1">Speaking...</span>
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 italic">
                  {liveAiSpeech}
                </div>
              </div>
            )}

            {liveUserSpeech && (
              <div className="flex flex-col items-end animate-pulse">
                <span className="text-[10px] text-emerald-600 mb-0.5 px-1">Listening...</span>
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 italic">
                  {liveUserSpeech}
                </div>
              </div>
            )}
          </div>

          {/* Quick text send input */}
          <div className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white">
            <input
              type="text"
              placeholder={isCallActive ? 'Type or speak into microphone...' : 'Start call to speak...'}
              value={textInputValue}
              disabled={!isCallActive || callStatus === 'Error' || callStatus === 'Connecting'}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendText();
              }}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 disabled:bg-slate-100"
            />
            <button
              onClick={handleSendText}
              disabled={!isCallActive || callStatus === 'Error' || callStatus === 'Connecting' || !textInputValue.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: AI Sales Insights */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              AI Sales Insights
            </span>
            {isSummarizing && (
              <span className="text-[11px] text-indigo-600 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analyzing
              </span>
            )}
          </div>

          {callSummary ? (
            <div className="space-y-4">
              {/* Sales Status Pill */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Final Status
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(
                    callSummary.finalSalesStatus
                  )}`}
                >
                  {callSummary.finalSalesStatus === 'Unclassified' ? 'Analysis unavailable' : callSummary.finalSalesStatus}
                </span>
              </div>

              {/* Summary */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">Summary</span>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl leading-relaxed border border-slate-100">
                  {callSummary.conversationSummary}
                </p>
              </div>

              {/* Requirements */}
              {callSummary.customerRequirements?.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">Requirements</span>
                  <div className="space-y-1">
                    {callSummary.customerRequirements.map((r, i) => (
                      <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Objections */}
              {callSummary.customerObjections?.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">Objections</span>
                  <div className="space-y-1">
                    {callSummary.customerObjections.map((o, i) => (
                      <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next steps */}
              {callSummary.recommendedNextSteps?.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1">Next Steps</span>
                  <div className="space-y-1">
                    {callSummary.recommendedNextSteps.map((s, i) => (
                      <div key={i} className="text-xs text-slate-700 flex items-start gap-1.5 font-medium">
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording Player */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2">Recording</span>
                <AudioPlayer
                  audioBlob={recordedAudioBlob}
                  durationSeconds={callDuration}
                  filename={`call-${currentCallId}.webm`}
                  title="Call Recording"
                />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs">Insights and recording will appear here after the call ends.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
