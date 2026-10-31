export class OptimizationEngine {
  static optimize(irInstructions, ast) {
    let instructions = JSON.parse(JSON.stringify(irInstructions || []));
    const allChanges = [];
    const passSnapshots = [];

    const isLogicGate = (inst) => inst.op !== 'BUF' && inst.op !== 'CONST';
    const initialGateCount = instructions.filter(isLogicGate).length;

    passSnapshots.push({
      passName: 'Initial IR',
      ir: JSON.parse(JSON.stringify(instructions)),
      changes: [],
      gateCount: initialGateCount,
    });

    let globalChanged = true;
    let iteration = 0;
    const maxIterations = 10;

    // Helper to find producer
    const getProducerMap = (list) => {
      const map = new Map();
      list.forEach((inst) => map.set(inst.target, inst));
      return map;
    };

    while (globalChanged && iteration < maxIterations) {
      globalChanged = false;
      iteration++;

      // -----------------------------------------------------------
      // 1. COPY PROPAGATION
      // -----------------------------------------------------------
      {
        const changes = [];
        const aliasMap = new Map();

        // Build alias map from BUF instructions: target = BUF(source)
        instructions.forEach((inst) => {
          if (inst.op === 'BUF' && inst.args.length === 1) {
            aliasMap.set(inst.target, inst.args[0]);
          }
        });

        // Resolve aliases transitively (with cycle guard)
        const resolveAlias = (val) => {
          let curr = val;
          const visited = new Set();
          while (aliasMap.has(curr) && !visited.has(curr)) {
            visited.add(curr);
            curr = aliasMap.get(curr);
          }
          return curr;
        };

        const newInsts = instructions.map((inst) => {
          let instChanged = false;
          const newArgs = inst.args.map((arg) => {
            const resolved = resolveAlias(arg);
            if (resolved !== arg) {
              instChanged = true;
              return resolved;
            }
            return arg;
          });

          if (instChanged) {
            const beforeStr = `${inst.target} = ${inst.op}(${inst.args.join(', ')})`;
            const afterStr = `${inst.target} = ${inst.op}(${newArgs.join(', ')})`;
            changes.push({
              pass: 'Copy Propagation',
              before: beforeStr,
              after: afterStr,
              target: inst.target,
              reason: `Propagated alias replacements into arguments of '${inst.target}'`,
            });
            globalChanged = true;
            return { ...inst, args: newArgs };
          }
          return inst;
        });

        instructions = newInsts;
        if (changes.length > 0) {
          allChanges.push(...changes);
          passSnapshots.push({
            passName: `Pass ${iteration}: Copy Propagation`,
            ir: JSON.parse(JSON.stringify(instructions)),
            changes,
            gateCount: instructions.filter(isLogicGate).length,
          });
        }
      }

      // -----------------------------------------------------------
      // 2. COMMON SUBEXPRESSION ELIMINATION (CSE)
      // -----------------------------------------------------------
      {
        const changes = [];
        const exprMap = new Map();
        const commutativeOps = new Set([
          'AND',
          'OR',
          'XOR',
          'NAND',
          'NOR',
          'XNOR',
        ]);

        const newInsts = instructions.map((inst) => {
          if (inst.op === 'BUF' || inst.op === 'DFF') return inst;

          let sortedArgs = [...inst.args];
          if (commutativeOps.has(inst.op)) {
            sortedArgs.sort();
          }
          const key = `${inst.op}(${sortedArgs.join(',')})`;

          if (exprMap.has(key)) {
            const canonical = exprMap.get(key);
            const beforeStr = `${inst.target} = ${inst.op}(${inst.args.join(', ')})`;
            const afterStr = `${inst.target} = BUF(${canonical})`;
            changes.push({
              pass: 'CSE',
              before: beforeStr,
              after: afterStr,
              target: inst.target,
              reason: `Merged duplicate subexpression '${key}' with canonical '${canonical}'`,
            });
            globalChanged = true;
            return {
              ...inst,
              op: 'BUF',
              args: [canonical],
            };
          } else {
            exprMap.set(key, inst.target);
            return inst;
          }
        });

        instructions = newInsts;
        if (changes.length > 0) {
          allChanges.push(...changes);
          passSnapshots.push({
            passName: `Pass ${iteration}: CSE`,
            ir: JSON.parse(JSON.stringify(instructions)),
            changes,
            gateCount: instructions.filter(isLogicGate).length,
          });
        }
      }

      // -----------------------------------------------------------
      // 3. BOOLEAN ALGEBRAIC REWRITES & CONSTANT FOLDING
      // -----------------------------------------------------------
      {
        const changes = [];
        const producerMap = getProducerMap(instructions);

        const newInsts = instructions.map((inst) => {
          if (inst.op === 'BUF' || inst.op === 'DFF') return inst;

          const beforeStr = `${inst.target} = ${inst.op}(${inst.args.join(', ')})`;
          let simplified = null;
          let reason = '';

          // AND simplifications
          if (inst.op === 'AND') {
            // Nulling: AND with 0 is always 0
            if (inst.args.includes('0')) {
              simplified = { op: 'BUF', args: ['0'] };
              reason = `AND with constant '0' collapses to '0'`;
            } else {
              // Identity: remove all 1s
              let filtered = inst.args.filter((a) => a !== '1');
              // Deduplicate args: x & x -> x
              const deduped = Array.from(new Set(filtered));

              // Check complementarity: x & NOT(x) -> 0
              const hasComplement = deduped.some((arg) => {
                const prod = producerMap.get(arg);
                return prod && prod.op === 'NOT' && deduped.includes(prod.args[0]);
              });

              if (hasComplement) {
                simplified = { op: 'BUF', args: ['0'] };
                reason = `Complementarity x & NOT(x) collapses to '0'`;
              } else if (deduped.length === 0) {
                // All inputs were 1
                simplified = { op: 'BUF', args: ['1'] };
                reason = `All-ones AND collapses to '1'`;
              } else if (deduped.length === 1) {
                simplified = { op: 'BUF', args: [deduped[0]] };
                reason = `Idempotent AND with identical / identity inputs simplified to '${deduped[0]}'`;
              } else if (deduped.length < inst.args.length) {
                simplified = { op: 'AND', args: deduped };
                reason = `Deduplicated identical inputs in n-ary AND`;
              }
            }
          }

          // OR simplifications
          else if (inst.op === 'OR') {
            // Nulling: OR with 1 is always 1
            if (inst.args.includes('1')) {
              simplified = { op: 'BUF', args: ['1'] };
              reason = `OR with constant '1' collapses to '1'`;
            } else {
              // Identity: remove all 0s
              let filtered = inst.args.filter((a) => a !== '0');
              // Deduplicate args: x | x -> x
              const deduped = Array.from(new Set(filtered));

              // Check complementarity: x | NOT(x) -> 1
              const hasComplement = deduped.some((arg) => {
                const prod = producerMap.get(arg);
                return prod && prod.op === 'NOT' && deduped.includes(prod.args[0]);
              });

              if (hasComplement) {
                simplified = { op: 'BUF', args: ['1'] };
                reason = `Complementarity x | NOT(x) collapses to '1'`;
              } else if (deduped.length === 0) {
                // All inputs were 0
                simplified = { op: 'BUF', args: ['0'] };
                reason = `All-zeros OR collapses to '0'`;
              } else if (deduped.length === 1) {
                simplified = { op: 'BUF', args: [deduped[0]] };
                reason = `Idempotent OR with identical / identity inputs simplified to '${deduped[0]}'`;
              } else if (deduped.length < inst.args.length) {
                simplified = { op: 'OR', args: deduped };
                reason = `Deduplicated identical inputs in n-ary OR`;
              }
            }
          }

          // XOR simplifications
          else if (inst.op === 'XOR') {
            if (inst.args.length === 2) {
              const [a, b] = inst.args;
              if (a === b) {
                simplified = { op: 'BUF', args: ['0'] };
                reason = `XOR(x, x) self-cancellation collapses to '0'`;
              } else if (a === '0') {
                simplified = { op: 'BUF', args: [b] };
                reason = `XOR(0, x) identity simplified to '${b}'`;
              } else if (b === '0') {
                simplified = { op: 'BUF', args: [a] };
                reason = `XOR(x, 0) identity simplified to '${a}'`;
              } else if (b === '1') {
                simplified = { op: 'NOT', args: [a] };
                reason = `XOR(x, 1) rewritten to NOT('${a}')`;
              } else if (a === '1') {
                simplified = { op: 'NOT', args: [b] };
                reason = `XOR(1, x) rewritten to NOT('${b}')`;
              }
            }
          }

          // NOT simplifications
          else if (inst.op === 'NOT') {
            const arg = inst.args[0];
            if (arg === '0') {
              simplified = { op: 'BUF', args: ['1'] };
              reason = `Constant NOT(0) folded to '1'`;
            } else if (arg === '1') {
              simplified = { op: 'BUF', args: ['0'] };
              reason = `Constant NOT(1) folded to '0'`;
            } else {
              const prod = producerMap.get(arg);
              if (prod && prod.op === 'NOT') {
                simplified = { op: 'BUF', args: [prod.args[0]] };
                reason = `Double negation NOT(NOT('${prod.args[0]}')) folded to '${prod.args[0]}'`;
              }
            }
          }

          // NAND simplifications
          else if (inst.op === 'NAND') {
            if (inst.args.includes('0')) {
              simplified = { op: 'BUF', args: ['1'] };
              reason = `NAND with '0' collapses to '1'`;
            } else {
              const deduped = Array.from(new Set(inst.args.filter((a) => a !== '1')));
              if (deduped.length === 1) {
                simplified = { op: 'NOT', args: [deduped[0]] };
                reason = `NAND(x, x) / NAND(x, 1) simplified to NOT('${deduped[0]}')`;
              }
            }
          }

          // NOR simplifications
          else if (inst.op === 'NOR') {
            if (inst.args.includes('1')) {
              simplified = { op: 'BUF', args: ['0'] };
              reason = `NOR with '1' collapses to '0'`;
            } else {
              const deduped = Array.from(new Set(inst.args.filter((a) => a !== '0')));
              if (deduped.length === 1) {
                simplified = { op: 'NOT', args: [deduped[0]] };
                reason = `NOR(x, x) / NOR(x, 0) simplified to NOT('${deduped[0]}')`;
              }
            }
          }

          // XNOR simplifications
          else if (inst.op === 'XNOR' && inst.args.length === 2) {
            const [a, b] = inst.args;
            if (a === b) {
              simplified = { op: 'BUF', args: ['1'] };
              reason = `XNOR(x, x) equivalence collapses to '1'`;
            } else if (a === '1') {
              simplified = { op: 'BUF', args: [b] };
              reason = `XNOR(1, x) simplified to '${b}'`;
            } else if (b === '1') {
              simplified = { op: 'BUF', args: [a] };
              reason = `XNOR(x, 1) simplified to '${a}'`;
            } else if (a === '0') {
              simplified = { op: 'NOT', args: [b] };
              reason = `XNOR(0, x) simplified to NOT('${b}')`;
            } else if (b === '0') {
              simplified = { op: 'NOT', args: [a] };
              reason = `XNOR(x, 0) simplified to NOT('${a}')`;
            }
          }

          if (simplified) {
            const afterStr = `${inst.target} = ${simplified.op}(${simplified.args.join(', ')})`;
            changes.push({
              pass: 'Algebraic Rewrite',
              before: beforeStr,
              after: afterStr,
              target: inst.target,
              reason,
            });
            globalChanged = true;
            return {
              ...inst,
              ...simplified,
            };
          }
          return inst;
        });

        instructions = newInsts;
        if (changes.length > 0) {
          allChanges.push(...changes);
          passSnapshots.push({
            passName: `Pass ${iteration}: Algebraic Rewrites`,
            ir: JSON.parse(JSON.stringify(instructions)),
            changes,
            gateCount: instructions.filter(isLogicGate).length,
          });
        }
      }

      // -----------------------------------------------------------
      // 4. DEAD CODE ELIMINATION (DCE)
      // -----------------------------------------------------------
      {
        const changes = [];
        // Roots: strictly primary outputs and sequential state (DFF targets)
        const needed = new Set(ast.expandedOutputs || []);
        instructions.forEach((inst) => {
          if (inst.isSequential || inst.op === 'DFF') {
            needed.add(inst.target);
          }
        });

        const worklist = Array.from(needed);
        const liveTargets = new Set(worklist);
        const producerMap = getProducerMap(instructions);

        while (worklist.length > 0) {
          const curr = worklist.pop();
          const producer = producerMap.get(curr);
          if (producer) {
            producer.args.forEach((arg) => {
              if (arg !== '0' && arg !== '1' && !liveTargets.has(arg)) {
                liveTargets.add(arg);
                worklist.push(arg);
              }
            });
          }
        }

        const filtered = instructions.filter((inst) => {
          const isKept = liveTargets.has(inst.target);
          if (!isKept) {
            changes.push({
              pass: 'DCE',
              before: `${inst.target} = ${inst.op}(${inst.args.join(', ')})`,
              after: `[Eliminated]`,
              target: inst.target,
              reason: `Target '${inst.target}' has no active path to primary outputs or sequential state`,
            });
            globalChanged = true;
          }
          return isKept;
        });

        instructions = filtered;
        if (changes.length > 0) {
          allChanges.push(...changes);
          passSnapshots.push({
            passName: `Pass ${iteration}: DCE`,
            ir: JSON.parse(JSON.stringify(instructions)),
            changes,
            gateCount: instructions.filter(isLogicGate).length,
          });
        }
      }
    }

    const optimizedGateCount = instructions.filter(isLogicGate).length;
    const reductionPct =
      initialGateCount > 0
        ? Math.round(
            ((initialGateCount - optimizedGateCount) / initialGateCount) * 100
          )
        : 0;

    return {
      optimizedIR: instructions,
      passSnapshots,
      stats: {
        initialGateCount,
        optimizedGateCount,
        reductionPct,
        logs: allChanges,
      },
    };
  }
}
