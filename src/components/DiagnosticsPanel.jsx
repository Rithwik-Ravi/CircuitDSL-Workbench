import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  MapPin,
} from 'lucide-react';
export function DiagnosticsPanel({
  diagnostics = [],
  onSelectDiagnostic,
  onApplyFix,
}) {
  const errors = diagnostics.filter((d) => d.type === 'error');
  const warnings = diagnostics.filter((d) => d.type === 'warning');
  return (
    <div className="h-40 shrink-0 bg-[#292524]/90 border-t border-[#44403c] p-2 overflow-auto font-mono text-[11px]">
      <div className="text-[10px] uppercase font-bold text-[#a8a29e] mb-2 flex items-center justify-between sticky top-0 bg-[#292524]">
        <span>Compiler Diagnostics ({diagnostics.length})</span>
        <span className="normal-case font-normal">
          <span className="text-rose-400">{errors.length} errors</span>
          {' · '}
          <span className="text-amber-400">{warnings.length} warnings</span>
        </span>
      </div>
      {diagnostics.length === 0 ? (
        <div className="text-[#10b981] flex items-center gap-1.5 py-2">
          <CheckCircle className="w-3.5 h-3.5" />
          No lexical, syntax, or semantic errors detected.
        </div>
      ) : (
        <div className="space-y-2">
          {diagnostics.map((diag, idx) => (
            <div
              key={`${diag.line}-${diag.col}-${idx}`}
              className={`rounded-md border p-2 ${
                diag.type === 'error'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-amber-500/25 bg-amber-500/5'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDiagnostic?.(diag)}
                className="w-full text-left"
              >
                <span
                  className={`flex items-start gap-1.5 ${diag.type === 'error' ? 'text-rose-300' : 'text-amber-300'}`}
                >
                  {diag.type === 'error' ? (
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <span className="min-w-0">
                    <span className="font-semibold">
                      Line {diag.line || 1}, Column {diag.col || 1}:{' '}
                    </span>
                    {diag.message}
                  </span>
                  <MapPin className="w-3 h-3 shrink-0 ml-auto opacity-60" />
                </span>
              </button>
              {diag.explanation && (
                <p className="mt-1 ml-5 text-stone-300 leading-4">
                  <span className="text-stone-500">Why: </span>
                  {diag.explanation}
                </p>
              )}
              {diag.suggestion && (
                <p className="mt-1 ml-5 text-sky-300 leading-4">
                  <span className="text-sky-500">Suggestion: </span>
                  {diag.suggestion}
                </p>
              )}
              {diag.fix && (
                <div className="mt-2 ml-5">
                  <button
                    type="button"
                    onClick={() => onApplyFix?.(diag)}
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Wrench className="w-3 h-3" />
                    Apply suggested fix
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
