export const TRANSISTOR_COUNT_TABLE = {
  NOT: 2,
  BUF: 4,
  NAND: 4,
  NOR: 4,
  AND: 6,
  OR: 6,
  XOR: 8,
  XNOR: 8,
  DFF: 18,
};

export function calculateTransistorCount(irInstructions) {
  let count = 0;
  (irInstructions || []).forEach((inst) => {
    const op = inst.op.toUpperCase();
    if (op === 'NAND' || op === 'NOR') {
      const inputs = inst.args.length;
      count += inputs * 2;
    } else if (op === 'AND' || op === 'OR') {
      const inputs = inst.args.length;
      count += inputs * 2 + 2; // (inputs * 2) + 2 for inverter
    } else if (TRANSISTOR_COUNT_TABLE[op]) {
      count += TRANSISTOR_COUNT_TABLE[op];
    } else {
      count += 4;
    }
  });
  return count;
}

export function calculateLogicDepth(irInstructions, ast) {
  const signalDepths = new Map();

  // Inputs have depth 0
  (ast.expandedInputs || []).forEach((inp) => {
    signalDepths.set(inp, 0);
  });
  signalDepths.set('0', 0);
  signalDepths.set('1', 0);

  let changed = true;
  let iterations = 0;
  const maxIterations = (irInstructions || []).length + 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    (irInstructions || []).forEach((inst) => {
      // DFF breaks combinational timing path; output starts a new cycle at depth 0
      if (inst.op === 'DFF') {
        if (!signalDepths.has(inst.target) || signalDepths.get(inst.target) !== 0) {
          signalDepths.set(inst.target, 0);
          changed = true;
        }
        return;
      }

      const argDepths = inst.args.map((arg) => signalDepths.get(arg) ?? 0);
      const maxArgDepth = argDepths.length > 0 ? Math.max(...argDepths) : 0;
      const currentDepth = inst.op === 'BUF' ? maxArgDepth : maxArgDepth + 1;

      if (!signalDepths.has(inst.target) || signalDepths.get(inst.target) < currentDepth) {
        signalDepths.set(inst.target, currentDepth);
        changed = true;
      }
    });
  }

  let maxCircuitDepth = 0;
  (ast.expandedOutputs || []).forEach((outp) => {
    const d = signalDepths.get(outp) ?? 0;
    if (d > maxCircuitDepth) maxCircuitDepth = d;
  });

  if (maxCircuitDepth === 0 && signalDepths.size > 0) {
    for (const d of signalDepths.values()) {
      if (d > maxCircuitDepth) maxCircuitDepth = d;
    }
  }

  return {
    criticalPathDepth: maxCircuitDepth,
    signalDepths: Object.fromEntries(signalDepths),
  };
}

export function computeCircuitMetrics(rawIR, optimizedIR, ast) {
  const isLogicGate = (inst) => inst.op !== 'BUF' && inst.op !== 'CONST';

  const rawGateCount = (rawIR || []).filter(isLogicGate).length;
  const optGateCount = (optimizedIR || []).filter(isLogicGate).length;

  const rawTransistors = calculateTransistorCount(rawIR);
  const optTransistors = calculateTransistorCount(optimizedIR);

  const rawDepth = calculateLogicDepth(rawIR, ast);
  const optDepth = calculateLogicDepth(optimizedIR, ast);

  const gateSavingsPct =
    rawGateCount > 0
      ? Math.round(((rawGateCount - optGateCount) / rawGateCount) * 100)
      : 0;

  const transistorSavingsPct =
    rawTransistors > 0
      ? Math.round(((rawTransistors - optTransistors) / rawTransistors) * 100)
      : 0;

  return {
    raw: {
      gateCount: rawGateCount,
      transistorCount: rawTransistors,
      logicDepth: rawDepth.criticalPathDepth,
    },
    optimized: {
      gateCount: optGateCount,
      transistorCount: optTransistors,
      logicDepth: optDepth.criticalPathDepth,
    },
    savings: {
      gates: gateSavingsPct,
      transistors: transistorSavingsPct,
      depthDifference: rawDepth.criticalPathDepth - optDepth.criticalPathDepth,
    },
  };
}
