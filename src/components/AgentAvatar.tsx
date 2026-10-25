import React from 'react';
import { CallAgentStatus } from '../types';
import { Bot, Mic, Volume2, Sparkles, AlertCircle, PhoneOff } from 'lucide-react';

interface AgentAvatarProps {
  status: CallAgentStatus;
  agentName: string;
  isSpeaking: boolean;
  audioLevel?: number;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  status,
  agentName,
  isSpeaking,
  audioLevel = 0,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Speaking':
        return 'from-blue-600 via-indigo-600 to-purple-600';
      case 'Listening':
        return 'from-emerald-500 via-teal-500 to-cyan-500';
      case 'Connecting':
        return 'from-amber-500 via-orange-500 to-yellow-500';
      case 'Error':
        return 'from-rose-500 to-red-600';
      case 'Ended':
        return 'from-slate-400 to-slate-600';
      default:
        return 'from-blue-500 via-indigo-500 to-violet-600';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'Speaking':
        return {
          label: 'Alex is Speaking',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: <Volume2 className="w-3.5 h-3.5 animate-pulse text-indigo-600" />,
        };
      case 'Listening':
        return {
          label: 'Listening to Customer',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-600" />,
        };
      case 'Connecting':
        return {
          label: 'Connecting Session...',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />,
        };
      case 'Ended':
        return {
          label: 'Call Ended',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: <PhoneOff className="w-3.5 h-3.5 text-slate-500" />,
        };
      case 'Error':
        return {
          label: 'Connection Error',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      default:
        return {
          label: 'Ready to Call',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <Bot className="w-3.5 h-3.5 text-blue-600" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="flex flex-col items-center justify-center text-center">
      {/* Avatar Container with Animated Glowing Orbital Rings */}
      <div className="relative flex items-center justify-center my-4">
        {/* Outer Pulsing Wave Ring 1 */}
        {isSpeaking && (
          <div
            className="absolute -inset-4 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-indigo-500/20 blur-md animate-ping"
            style={{ animationDuration: '2s' }}
          />
        )}

        {/* Outer Pulsing Wave Ring 2 */}
        {(status === 'Speaking' || status === 'Listening') && (
          <div
            className={`absolute -inset-2 rounded-full blur-sm opacity-60 transition-all duration-300 ${
              status === 'Speaking'
                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 animate-pulse'
                : 'bg-gradient-to-tr from-emerald-400 to-cyan-500 animate-pulse'
            }`}
          />
        )}

        {/* Main Avatar Circle */}
        <div
          className={`relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr ${getStatusColor()} shadow-xl shadow-indigo-500/15 flex items-center justify-center transition-transform duration-300 ${
            isSpeaking ? 'scale-105' : 'scale-100'
          }`}
        >
          <div className="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden border border-white/20">
            {/* Ambient Background Grid inside Avatar */}
            <div className="absolute inset-0 bg-radial from-indigo-500/30 via-transparent to-transparent opacity-80" />

            {/* Avatar Holographic Core */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {status === 'Speaking' ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-6 bg-gradient-to-t from-blue-400 to-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-9 bg-gradient-to-t from-purple-400 to-pink-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-5 bg-gradient-to-t from-cyan-400 to-blue-300 rounded-full animate-bounce" />
                </div>
              ) : status === 'Listening' ? (
                <Mic className="w-10 h-10 text-emerald-400 animate-pulse" />
              ) : (
                <Bot className="w-10 h-10 text-blue-300" />
              )}
            </div>

            {/* Glowing bottom sheen */}
            <div className="absolute -bottom-2 w-16 h-4 bg-indigo-400/50 rounded-full blur-sm" />
          </div>
        </div>

        {/* Small Floating Micro-Badge */}
        <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md border border-slate-100">
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center ${
              status === 'Speaking'
                ? 'bg-indigo-600'
                : status === 'Listening'
                ? 'bg-emerald-500'
                : status === 'Connecting'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Name and Designation */}
      <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
        {agentName}
        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200/60">
          AI Sales Rep
        </span>
      </h3>
      <p className="text-xs text-slate-500 font-medium mt-0.5">
        FlowCRM Voice Executive
      </p>

      {/* Live Status Pill */}
      <div
        className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} shadow-xs transition-colors`}
      >
        {badge.icon}
        <span>{badge.label}</span>
      </div>
    </div>
  );
};
