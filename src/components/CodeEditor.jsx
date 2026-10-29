import React, { useEffect, useMemo, useRef } from 'react';
import { Code, Copy, AlertCircle, AlertTriangle } from 'lucide-react';
export function CodeEditor({
  dslCode,
  setDslCode,
  lineWrap,
  setLineWrap,
  diagnostics = [],
  onDiagnosticSelect,
  selectedDiagnostic,
}) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const highlightRef = useRef(null);
  const lines = useMemo(() => dslCode.split('\n'), [dslCode]);
  const diagnosticsByLine = useMemo(() => {
    const result = new Map();
    diagnostics.forEach((diagnostic) => {
      const line = Math.max(1, Number(diagnostic.line) || 1);
      if (!result.has(line)) {
        result.set(line, []);
      }
      result.get(line).push(diagnostic);
    });
    return result;
  }, [diagnostics]);
  useEffect(() => {
    if (!selectedDiagnostic || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const targetLine = Math.max(1, Number(selectedDiagnostic.line) || 1);
    const targetCol = Math.max(1, Number(selectedDiagnostic.col) || 1);
    const lineIndex = Math.min(targetLine - 1, lines.length - 1);
    const before = lines.slice(0, lineIndex).join('\n');
    const start = before.length + (lineIndex > 0 ? 1 : 0) + targetCol - 1;
    const lineText = lines[lineIndex] || '';
    const selectionStart = Math.min(start, dslCode.length);
    const selectionEnd = Math.min(selectionStart + 1, dslCode.length);
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
    // Move the editor close to the diagnostic.
    const lineHeight = 20;
    textarea.scrollTop = Math.max(
      0,
      lineIndex * lineHeight - textarea.clientHeight / 2
    );
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
    }
  }, [selectedDiagnostic, dslCode, lines]);
  const handleScroll = (event) => {
    const textarea = event.currentTarget;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
      gutterRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dslCode);
    } catch (error) {
      console.error('Unable to copy source code:', error);
    }
  };
  return (
    <div className="min-h-0 flex-1 flex flex-col bg-[#1c1917]">
      <div className="h-10 shrink-0 bg-[#292524]/80 px-4 flex items-center justify-between border-b border-[#44403c]">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-[#f59e0b]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#a8a29e]">
            DSL Source Code
          </span>
          {diagnostics.some((d) => d.type === 'error') && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400">
              <AlertCircle className="w-3 h-3" />
              Errors
            </span>
          )}
          {diagnostics.some((d) => d.type === 'warning') && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Warnings
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLineWrap((previous) => !previous)}
            className={`px-2 py-0.5 text-[11px] rounded border ${
              lineWrap
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40'
                : 'text-[#a8a29e] border-[#44403c]'
            }`}
          >
            {lineWrap ? 'Wrap On' : 'Wrap Off'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-[#a8a29e] hover:text-[#fefae0]"
            title="Copy Source"
            aria-label="Copy source code"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 flex overflow-hidden font-mono text-xs">
        {/* Line number gutter */}
        <div
          ref={gutterRef}
          className="w-12 shrink-0 overflow-hidden bg-[#292524]/40 text-right border-r border-[#44403c]/40"
        >
          <div className="py-3">
            {lines.map((line, index) => {
              const lineNo = index + 1;
              const lineDiagnostics = diagnosticsByLine.get(lineNo) || [];
              const isError = lineDiagnostics.some((d) => d.type === 'error');
              const isWarning = lineDiagnostics.some(
                (d) => d.type === 'warning'
              );
              const isSelected = Number(selectedDiagnostic?.line) === lineNo;
              return (
                <button
                  key={lineNo}
                  type="button"
                  onClick={() => {
                    const diagnostic = lineDiagnostics[0];
                    if (diagnostic) {
                      onDiagnosticSelect?.(diagnostic);
                    }
                  }}
                  title={
                    lineDiagnostics.length
                      ? lineDiagnostics.map((d) => d.message).join('\n')
                      : `Line ${lineNo}`
                  }
                  className={`block w-full h-5 pr-3 leading-5 ${
                    isSelected
                      ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                      : isError
                        ? 'bg-rose-500/15 text-rose-400'
                        : isWarning
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'text-[#78716c]'
                  }`}
                >
                  {lineNo}
                </button>
              );
            })}
          </div>
        </div>
        {/* Source editor */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {/* Background highlights */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className={`absolute inset-0 overflow-hidden pointer-events-none ${
              lineWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
          >
            <div className="py-3">
              {lines.map((line, index) => {
                const lineNo = index + 1;
                const lineDiagnostics = diagnosticsByLine.get(lineNo) || [];
                const isError = lineDiagnostics.some((d) => d.type === 'error');
                const isWarning = lineDiagnostics.some(
                  (d) => d.type === 'warning'
                );
                const isSelected = Number(selectedDiagnostic?.line) === lineNo;
                return (
                  <div
                    key={lineNo}
                    className={`min-h-5 leading-5 px-3 ${
                      isSelected
                        ? 'bg-[#f59e0b]/10'
                        : isError
                          ? 'bg-rose-500/10'
                          : isWarning
                            ? 'bg-amber-500/10'
                            : ''
                    }`}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={dslCode}
            onChange={(event) => setDslCode(event.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="DSL source code editor"
            className={`relative z-10 block w-full h-full resize-none bg-transparent text-[#e7e5e4] caret-amber-400 outline-none py-3 px-3 leading-5 ${
              lineWrap
                ? 'whitespace-pre-wrap break-words'
                : 'whitespace-pre overflow-x-auto'
            }`}
            style={{
              tabSize: 2,
              overflowWrap: lineWrap ? 'anywhere' : 'normal',
            }}
          />
        </div>
      </div>
    </div>
  );
}
