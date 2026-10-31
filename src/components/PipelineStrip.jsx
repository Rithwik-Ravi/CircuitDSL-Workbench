import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

export function PipelineStrip({ timings = {}, diagnostics = [], hasErrors }) {
  const stages = [
    { key: 'lex', label: 'Lex', time: timings.lex || 0 },
    { key: 'parse', label: 'Parse', time: timings.parse || 0 },
    { key: 'sema', label: 'Sema', time: timings.sema || 0 },
    { key: 'ir', label: 'IR', time: timings.ir || 0 },
    { key: 'opt', label: 'Opt', time: timings.opt || 0 },
    { key: 'gen', label: 'Gen', time: timings.gen || 0 },
    { key: 'equiv', label: 'Equiv', time: timings.equiv || 0 },
  ];

  const hasWarnings = diagnostics.some((d) => d.severity === 'warning');

  return (
    <div className="h-8 bg-[#1f1d1b] border-t border-[#3b3836] px-4 flex items-center justify-between text-xs select-none">
      <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1">
        <span className="text-[11px] font-bold text-[#a8a29e] uppercase tracking-wider mr-1">
          Pipeline:
        </span>
        {stages.map((st, idx) => {
          let statusColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50';
          let Icon = CheckCircle2;

          if (hasErrors) {
            if (st.key === 'sema' || st.key === 'parse' || st.key === 'lex') {
              statusColor = 'text-rose-400 bg-rose-950/40 border-rose-800/50';
              Icon = XCircle;
            } else {
              statusColor = 'text-stone-500 bg-stone-900 border-stone-800 opacity-50';
            }
          } else if (hasWarnings && (st.key === 'parse' || st.key === 'sema')) {
            statusColor = 'text-amber-400 bg-amber-950/40 border-amber-800/50';
            Icon = AlertTriangle;
          }

          return (
            <React.Fragment key={st.key}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all ${statusColor}`}
              >
                <Icon size={12} />
                <span>{st.label}</span>
                <span className="font-mono text-[10px] opacity-75">{st.time}ms</span>
              </div>
              {idx < stages.length - 1 && (
                <span className="text-stone-600 font-bold text-[10px]">›</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center space-x-2 text-[11px] font-mono text-[#a8a29e] pl-2 flex-shrink-0">
        <Clock size={12} className="text-amber-400" />
        <span>Total: {timings.total || 0}ms</span>
      </div>
    </div>
  );
}
