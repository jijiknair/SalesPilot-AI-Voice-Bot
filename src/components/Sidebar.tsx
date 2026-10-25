import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  History,
  Settings,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentTab: 'dashboard' | 'make-call' | 'call-history' | 'settings';
  setCurrentTab: (tab: 'dashboard' | 'make-call' | 'call-history' | 'settings') => void;
  isCallActive?: boolean;
  productName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isCallActive = false,
  productName,
}) => {
  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'make-call' as const,
      label: 'Make a Call',
      icon: PhoneCall,
      badge: isCallActive ? 'Live' : null,
    },
    {
      id: 'call-history' as const,
      label: 'Call History',
      icon: History,
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800/80 select-none min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-tight text-white">
              SalesPilot<span className="text-indigo-400"> AI</span>
            </div>
            <p className="text-[11px] text-slate-400">{productName} Voice Bot</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </aside>
  );
};
