export class IRBuilder {
  static buildIR(ast) {
    const irInstructions = [];
    let tempId = 1;

    const flattenExpr = (expr) => {
      if (expr.type === 'VAR') return expr.name;
      if (expr.type === 'CONST') return `${expr.value}`;

      if (expr.type === 'GATE') {
        const argNames = expr.args.map((arg) => flattenExpr(arg));
        const tempTarget = `_t${tempId++}`;
        irInstructions.push({
          target: tempTarget,
          op: expr.gateType,
          args: argNames,
          isTemporary: true,
        });
        return tempTarget;
      }
      return '0';
    };

    ast.assignments.forEach((assign) => {
      const resultName = flattenExpr(assign.expr);
      irInstructions.push({
        target: assign.target,
        op: 'BUF',
        args: [resultName],
        isTemporary: false,
      });
    });

    return irInstructions;
  }
}
