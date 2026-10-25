import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Trash2,
  X,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { CallRecord, SalesStatus } from '../types';
import { AudioPlayer } from '../components/AudioPlayer';
import { getLocalAudioBlob } from '../lib/callRepository';

interface CallHistoryProps {
  calls: CallRecord[];
  selectedCall: CallRecord | null;
  setSelectedCall: (call: CallRecord | null) => void;
  onDeleteCall?: (id: string) => Promise<void>;
}

export const CallHistory: React.FC<CallHistoryProps> = ({
  calls,
  selectedCall,
  setSelectedCall,
  onDeleteCall,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCallBlob, setSelectedCallBlob] = useState<{ callId: string; blob: Blob | null } | null>(null);

  useEffect(() => {
    let active = true;
    setSelectedCallBlob(null);
    if (selectedCall) {
      getLocalAudioBlob(selectedCall.id).then((blob) => {
        if (active) setSelectedCallBlob({ callId: selectedCall.id, blob });
      });
    } else {
      setSelectedCallBlob(null);
    }
    return () => {
      active = false;
    };
  }, [selectedCall]);

  const getStatusBadge = (status: SalesStatus) => {
    switch (status) {
      case 'Converted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Demo Requested':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Interested':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Follow-up Required':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Not Interested':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Unclassified':
      case 'No Response':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      (call.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.summary?.conversationSummary || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || call.salesStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by prospect or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses ({calls.length})</option>
            <option value="Converted">Converted</option>
            <option value="Demo Requested">Demo Requested</option>
            <option value="Interested">Interested</option>
            <option value="Follow-up Required">Follow-up Required</option>
            <option value="Not Interested">Not Interested</option>
            <option value="No Response">No Response</option>
            <option value="Unclassified">Analysis unavailable</option>
          </select>
        </div>
      </div>

      {/* Clean Calls Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filteredCalls.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs">No calls found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Prospect</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4">Audio</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCalls.map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-700 font-medium">
                      {new Date(call.startedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {call.customerName || 'Prospect'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] border ${getStatusBadge(
                          call.salesStatus
                        )}`}
                      >
                        {call.salesStatus === 'Unclassified' ? 'Analysis unavailable' : call.salesStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-500 truncate">
                      {call.summary?.conversationSummary || 'Recorded'}
                    </td>
                    <td className="py-3.5 px-4">
                      {call.recordingUrl || call.recordingBlobId ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <span className="text-slate-400">Unavailable</span>}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCall(call);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simple Details Drawer */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Call Details</h3>
                <span
                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(
                    selectedCall.salesStatus
                  )}`}
                >
                  {selectedCall.salesStatus === 'Unclassified' ? 'Analysis unavailable' : selectedCall.salesStatus}
                </span>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Audio player */}
              <AudioPlayer
                audioBlob={selectedCallBlob?.callId === selectedCall.id ? selectedCallBlob.blob : null}
                durationSeconds={selectedCall.recordingDuration || selectedCall.durationSeconds}
                audioUrl={selectedCall.recordingUrl}
                filename={`call-${selectedCall.id}.webm`}
                title={`${selectedCall.customerName || 'Prospect'} • Call Recording`}
              />

              {/* Summary */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">Summary</h4>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedCall.summary?.conversationSummary}
                </p>
              </div>

              {/* Requirements */}
              {selectedCall.summary?.customerRequirements?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Customer Requirements</h4>
                  <div className="space-y-1">
                    {selectedCall.summary.customerRequirements.map((r, i) => (
                      <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Objections */}
              {selectedCall.summary?.customerObjections?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Objections</h4>
                  <div className="space-y-1">
                    {selectedCall.summary.customerObjections.map((o, i) => (
                      <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {selectedCall.summary?.recommendedNextSteps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Next Steps</h4>
                  <div className="space-y-1">
                    {selectedCall.summary.recommendedNextSteps.map((s, i) => (
                      <div key={i} className="text-xs text-slate-700 font-medium flex items-start gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">Transcript</h4>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 max-h-60 overflow-y-auto">
                  {selectedCall.transcript?.length > 0 ? (
                    selectedCall.transcript.map((m) => (
                      <div key={m.id} className="text-xs">
                        <span className="font-bold text-slate-700">
                          {m.sender === 'ai' ? selectedCall.agentName : 'Customer'}:{' '}
                        </span>
                        <span className="text-slate-600">{m.text}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No text transcript available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              {onDeleteCall && (
                <button
                  onClick={async () => {
                    await onDeleteCall(selectedCall.id);
                    setSelectedCall(null);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Delete Call
                </button>
              )}
              <button
                onClick={() => setSelectedCall(null)}
                className="ml-auto px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
