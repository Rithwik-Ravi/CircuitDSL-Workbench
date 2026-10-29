export class SemanticAnalyzer {
  static analyze(ast) {
    const diagnostics = [];
    const declaredSignals = new Map();

    const addSignal = (name, category, line, col) => {
      if (declaredSignals.has(name)) {
        diagnostics.push({
          type: 'error',
          line,
          col,
          message: `Semantic Error: Duplicate declaration of signal '${name}' (already declared as ${declaredSignals.get(name).category})`,
        });
      } else {
        declaredSignals.set(name, { category, line, col });
      }
    };

    ast.expandedInputs.forEach((inp) => addSignal(inp, 'input', 1, 1));
    ast.expandedOutputs.forEach((outp) => addSignal(outp, 'output', 1, 1));
    ast.expandedWires.forEach((w) => addSignal(w, 'wire', 1, 1));

    declaredSignals.set('0', { category: 'const' });
    declaredSignals.set('1', { category: 'const' });

    const drivenSignals = new Set();

    const checkExprVars = (expr, line, col) => {
      if (!expr) return;
      if (expr.type === 'VAR') {
        if (!declaredSignals.has(expr.name)) {
          diagnostics.push({
            type: 'error',
            line: expr.line || line,
            col: expr.col || col,
            message: `Semantic Error: Undefined signal reference '${expr.name}'`,
          });
        }
      } else if (expr.type === 'GATE') {
        expr.args.forEach((arg) => checkExprVars(arg, line, col));
      }
    };

    ast.assignments.forEach((assign) => {
      const sig = declaredSignals.get(assign.target);
      if (!sig) {
        diagnostics.push({
          type: 'error',
          line: assign.line,
          col: assign.col,
          message: `Semantic Error: Assignment to undeclared signal '${assign.target}'`,
        });
      } else if (sig.category === 'input') {
        diagnostics.push({
          type: 'error',
          line: assign.line,
          col: assign.col,
          message: `Semantic Error: Cannot drive input signal '${assign.target}'`,
        });
      }

      if (drivenSignals.has(assign.target)) {
        diagnostics.push({
          type: 'error',
          line: assign.line,
          col: assign.col,
          message: `Semantic Error: Signal '${assign.target}' driven by multiple sources`,
        });
      }
      drivenSignals.add(assign.target);

      checkExprVars(assign.expr, assign.line, assign.col);
    });

    ast.expandedOutputs.forEach((outp) => {
      if (!drivenSignals.has(outp) && !ast.expandedInputs.includes(outp)) {
        diagnostics.push({
          type: 'warning',
          line: 1,
          col: 1,
          message: `Semantic Warning: Primary output '${outp}' is undriven`,
        });
      }
    });

    return diagnostics;
  }
}
