import React from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  isCallActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  isCallActive,
}) => {
  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          {title}
          {isCallActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Live Call
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

    </header>
  );
};
