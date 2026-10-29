export class OptimizationEngine {
  static optimize(irInstructions, ast) {
    let instructions = JSON.parse(JSON.stringify(irInstructions));
    const logs = [];
    const initialGateCount = instructions.filter(
      (i) => i.op !== 'BUF' || i.args[0] !== i.target
    ).length;

    let changed = true;
    let passes = 0;

    while (changed && passes < 10) {
      changed = false;
      passes++;

      // 1. Common Subexpression Elimination (CSE)
      const exprMap = new Map();
      const replacements = new Map();

      instructions.forEach((inst) => {
        if (inst.op !== 'BUF') {
          let sortedArgs = [...inst.args];
          if (['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(inst.op))
            sortedArgs.sort();
          const key = `${inst.op}(${sortedArgs.join(',')})`;

          if (exprMap.has(key)) {
            const canonical = exprMap.get(key);
            replacements.set(inst.target, canonical);
            logs.push({
              pass: 'CSE',
              message: `Common Subexpression: Merged duplicate '${key}' into '${canonical}', replacing '${inst.target}'`,
            });
            changed = true;
          } else {
            exprMap.set(key, inst.target);
          }
        }
      });

      if (replacements.size > 0) {
        instructions = instructions.map((inst) => ({
          ...inst,
          args: inst.args.map((a) => replacements.get(a) || a),
        }));
      }

      // 2. Boolean Simplification & Constant Folding
      instructions = instructions.map((inst) => {
        if (inst.op === 'OR') {
          if (inst.args[0] === inst.args[1]) {
            logs.push({
              pass: 'BOOLEAN_SIMP',
              message: `Simplified OR(${inst.args[0]}, ${inst.args[1]}) -> ${inst.args[0]}`,
            });
            changed = true;
            return { ...inst, op: 'BUF', args: [inst.args[0]] };
          }
          if (inst.args.includes('0')) {
            const nonZero = inst.args.filter((a) => a !== '0');
            if (nonZero.length === 1) {
              logs.push({
                pass: 'CONSTANT_FOLDING',
                message: `Folded OR with '0' to ${nonZero[0]}`,
              });
              changed = true;
              return { ...inst, op: 'BUF', args: [nonZero[0]] };
            }
          }
        }
        if (inst.op === 'AND') {
          if (inst.args.includes('0')) {
            logs.push({
              pass: 'CONSTANT_FOLDING',
              message: `Folded AND with '0' to constant '0'`,
            });
            changed = true;
            return { ...inst, op: 'BUF', args: ['0'] };
          }
        }
        return inst;
      });

      // 3. Dead Code Elimination (DCE)
      const needed = new Set(ast.expandedOutputs);
      instructions.forEach((inst) => {
        if (!inst.isTemporary) needed.add(inst.target);
      });

      let worklist = Array.from(needed);
      const activeTargets = new Set(worklist);

      while (worklist.length > 0) {
        const curr = worklist.pop();
        const producer = instructions.find((i) => i.target === curr);
        if (producer) {
          producer.args.forEach((arg) => {
            if (!activeTargets.has(arg)) {
              activeTargets.add(arg);
              worklist.push(arg);
            }
          });
        }
      }

      const filtered = instructions.filter((inst) => {
        const isKept = activeTargets.has(inst.target);
        if (!isKept) {
          logs.push({
            pass: 'DCE',
            message: `Eliminated unused dead gate target '${inst.target}' (${inst.op})`,
          });
          changed = true;
        }
        return isKept;
      });

      instructions = filtered;
    }

    const optimizedGateCount = instructions.filter(
      (i) => i.op !== 'BUF' || i.target !== i.args[0]
    ).length;

    return {
      optimizedIR: instructions,
      stats: {
        initialGateCount,
        optimizedGateCount,
        reductionPct:
          initialGateCount > 0
            ? Math.round(
                ((initialGateCount - optimizedGateCount) / initialGateCount) *
                  100
              )
            : 0,
        logs,
      },
    };
  }
}
