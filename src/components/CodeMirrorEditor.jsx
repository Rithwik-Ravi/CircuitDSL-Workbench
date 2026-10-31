import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { setDiagnostics } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { KNOWN_GATES } from '../compiler/ASTParser.js';

// Custom Syntax Mode for CircuitDSL
const circuitDSLLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;

    // Single-line comment
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // Block comment
    if (stream.match('/*')) {
      while (!stream.match('*/', false)) {
        if (!stream.next()) break;
      }
      stream.match('*/');
      return 'comment';
    }

    // Keywords
    if (stream.match(/\b(circuit|module|input|output|wire|Wire|assert|test)\b/)) {
      return 'keyword';
    }

    // Digital Logic Gates
    if (stream.match(/\b(AND|OR|XOR|NOT|NAND|NOR|XNOR|BUF|DFF)\b/)) {
      return 'typeName';
    }

    // Numbers & Constants
    if (stream.match(/\b[0-9]+\b/)) {
      return 'number';
    }

    // Identifiers
    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) {
      return 'variableName';
    }

    // Operators and Delimiters
    if (stream.match(/[{}()[\]:;=,]/)) {
      return 'punctuation';
    }

    stream.next();
    return null;
  },
});

export function CodeMirrorEditor({
  dslCode,
  setDslCode,
  diagnostics = [],
  onCompile,
  theme = 'dark',
  selectedDiagnostic,
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);

  // Autocomplete provider for gates and declared signals
  const circuitCompletion = (context) => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const gateOptions = KNOWN_GATES.map((gate) => ({
      label: gate,
      type: 'function',
      detail: 'Logic Gate',
      boost: 2,
    }));

    const keywordOptions = ['circuit', 'input', 'output', 'wire', 'Wire'].map((kw) => ({
      label: kw,
      type: 'keyword',
      boost: 1,
    }));

    return {
      from: word.from,
      options: [...gateOptions, ...keywordOptions],
    };
  };

  // Initialize CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    const compileKeymap = [
      {
        key: 'Mod-Enter',
        run: () => {
          if (onCompile) onCompile();
          return true;
        },
      },
    ];

    const state = EditorState.create({
      doc: dslCode,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [circuitCompletion] }),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        circuitDSLLanguage,
        theme === 'dark' ? oneDark : [],
        keymap.of([
          ...compileKeymap,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextCode = update.state.doc.toString();
            setDslCode(nextCode);
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            fontFamily: '"JetBrains Mono", Consolas, monospace',
          },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { padding: '12px 0' },
          '.cm-line': { padding: '0 16px' },
          '&.cm-focused .cm-cursor': { borderLeftColor: '#f59e0b' },
          '&.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [theme]);

  // Sync external dslCode changes (e.g. preset selection)
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== dslCode) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: dslCode },
      });
    }
  }, [dslCode]);

  // Sync diagnostics to CodeMirror lint markers
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const cmDiagnostics = diagnostics.map((diag) => {
      const lineNum = Math.min(
        Math.max(1, diag.line || 1),
        view.state.doc.lines
      );
      const lineObj = view.state.doc.line(lineNum);
      const startCol = Math.max(1, diag.col || 1);
      const from = Math.min(lineObj.from + startCol - 1, lineObj.to);
      const to = Math.min(from + Math.max(1, (diag.endCol || startCol + 1) - startCol), lineObj.to);

      return {
        from,
        to: Math.max(from + 1, to),
        severity: diag.severity === 'warning' ? 'warning' : 'error',
        message: `${diag.message}\n${diag.explanation || ''}`,
      };
    });

    view.dispatch(setDiagnostics(view.state, cmDiagnostics));
  }, [diagnostics]);

  // Jump to selected diagnostic position
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedDiagnostic) return;

    const lineNum = Math.min(
      Math.max(1, selectedDiagnostic.line || 1),
      view.state.doc.lines
    );
    const lineObj = view.state.doc.line(lineNum);
    const pos = Math.min(
      lineObj.from + Math.max(0, (selectedDiagnostic.col || 1) - 1),
      lineObj.to
    );

    view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    view.focus();
  }, [selectedDiagnostic]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#181615] flex flex-col">
      <div ref={containerRef} className="w-full h-full overflow-hidden" />
    </div>
  );
}
