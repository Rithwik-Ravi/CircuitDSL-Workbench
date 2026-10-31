export class IRBuilder {
  static buildIR(ast) {
    const irInstructions = [];
    let tempId = 1;

    // Collect all user-declared names to prevent temp name collision
    const userNames = new Set([
      ...(ast.expandedInputs || []),
      ...(ast.expandedOutputs || []),
      ...(ast.expandedWires || []),
      ...(ast.assignments || []).map((a) => a.target),
    ]);

    const getNextTemp = () => {
      let candidate = `_t${tempId++}`;
      while (userNames.has(candidate)) {
        candidate = `_t${tempId++}`;
      }
      return candidate;
    };

    const flattenExpr = (expr) => {
      if (!expr) return '0';
      if (expr.type === 'VAR') return expr.name;
      if (expr.type === 'CONST') return `${expr.value}`;

      if (expr.type === 'GATE') {
        const argNames = expr.args.map((arg) => flattenExpr(arg));
        const tempTarget = getNextTemp();
        const isSequential = expr.gateType.toUpperCase() === 'DFF';
        irInstructions.push({
          target: tempTarget,
          op: expr.gateType.toUpperCase(),
          args: argNames,
          isTemporary: true,
          isSequential,
          line: expr.line,
          col: expr.col,
        });
        return tempTarget;
      }
      return '0';
    };

    (ast.assignments || []).forEach((assign) => {
      const resultName = flattenExpr(assign.expr);
      irInstructions.push({
        target: assign.target,
        op: 'BUF',
        args: [resultName],
        isTemporary: false,
        line: assign.line,
        col: assign.col,
      });
    });

    return irInstructions;
  }
}
