import React from 'react';
import {
  PhoneCall,
  CheckCircle2,
  CalendarCheck,
  TrendingUp,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { CallRecord, DashboardMetrics, SalesStatus } from '../types';
import { computeDashboardMetrics } from '../lib/callRepository';

interface DashboardProps {
  calls: CallRecord[];
  productName: string;
  agentName: string;
  onStartCall: () => void;
  onViewCallDetails: (call: CallRecord) => void;
  onNavigateToHistory: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  calls,
  productName,
  agentName,
  onStartCall,
  onViewCallDetails,
  onNavigateToHistory,
}) => {
  const metrics: DashboardMetrics = computeDashboardMetrics(calls);
  const recentCalls = calls.slice(0, 5);

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

  const statusBars = [
    { label: 'Converted', count: metrics.convertedCustomers, color: 'bg-emerald-500' },
    { label: 'Demo Requested', count: metrics.demoRequests, color: 'bg-indigo-500' },
    { label: 'Interested', count: metrics.interestedCustomers, color: 'bg-blue-500' },
    { label: 'Follow-up Required', count: metrics.followUpRequired, color: 'bg-amber-500' },
    { label: 'Not Interested', count: metrics.notInterested, color: 'bg-rose-500' },
    { label: 'No Response', count: metrics.noResponse, color: 'bg-slate-400' },
    ...(metrics.unclassified ? [{ label: 'Analysis unavailable', count: metrics.unclassified, color: 'bg-slate-400' }] : []),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Clean Welcome Action Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Sales Assistant Overview
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {agentName} is ready to qualify customer leads for {productName} via two-way voice.
          </p>
        </div>
        <button
          onClick={onStartCall}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <PhoneCall className="w-4 h-4" />
          <span>Start Voice Call</span>
        </button>
      </div>

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Calls</span>
            <PhoneCall className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.totalCalls}</div>
          <p className="text-[11px] text-slate-400 mt-1">Recorded sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-semibold">Interested</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.interestedCustomers}</div>
          <p className="text-[11px] text-blue-600 mt-1">Positive prospects</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-semibold">Demo Requests</span>
            <CalendarCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{metrics.demoRequests}</div>
          <p className="text-[11px] text-indigo-600 mt-1">Live walk-throughs</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold">Converted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 flex items-baseline gap-2">
            <span>{metrics.convertedCustomers}</span>
            <span className="text-xs font-bold text-emerald-600">({metrics.conversionRate}%)</span>
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Closed subscriptions</p>
        </div>
      </div>

      {/* Grid: Status Breakdown + Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Status Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Sales Status Breakdown
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Automated lead categorization by Gemini
          </p>

          <div className="space-y-3.5">
            {statusBars.map((item) => {
              const pct = metrics.totalCalls > 0 ? Math.round((item.count / metrics.totalCalls) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {item.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Calls List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Calls</h3>
              <p className="text-xs text-slate-400">Latest conversations and transcripts</p>
            </div>
            <button
              onClick={onNavigateToHistory}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentCalls.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <p className="text-xs">No calls recorded yet. Click Make a Call to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="pb-2.5">Prospect</th>
                    <th className="pb-2.5">Duration</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentCalls.map((call) => (
                    <tr
                      key={call.id}
                      onClick={() => onViewCallDetails(call)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">
                          {call.customerName || 'Prospect'}
                        </div>
                        {call.companyName && (
                          <div className="text-[11px] text-slate-400">{call.companyName}</div>
                        )}
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                            call.salesStatus
                          )}`}
                        >
                          {call.salesStatus === 'Unclassified' ? 'Analysis unavailable' : call.salesStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-indigo-600 hover:underline font-semibold text-[11px]">
                          View
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
