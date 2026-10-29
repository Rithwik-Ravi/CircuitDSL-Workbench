export function evaluateCircuitIR(irInstructions, inputs) {
  const signals = { ...inputs, 0: 0, 1: 1 };
  let changed = true;
  let passes = 0;

  while (changed && passes < 15) {
    changed = false;
    passes++;

    irInstructions.forEach((inst) => {
      const argVals = inst.args.map((a) => signals[a] ?? 0);
      let res = 0;

      switch (inst.op) {
        case 'AND':
          res = argVals.reduce((a, b) => a & b, 1);
          break;
        case 'OR':
          res = argVals.reduce((a, b) => a | b, 0);
          break;
        case 'XOR':
          res = argVals.reduce((a, b) => a ^ b, 0);
          break;
        case 'NAND':
          res = ~argVals.reduce((a, b) => a & b, 1) & 1;
          break;
        case 'NOR':
          res = ~argVals.reduce((a, b) => a | b, 0) & 1;
          break;
        case 'XNOR':
          res = ~argVals.reduce((a, b) => a ^ b, 0) & 1;
          break;
        case 'NOT':
          res = argVals[0] ? 0 : 1;
          break;
        case 'BUF':
          res = argVals[0] ?? 0;
          break;
        default:
          res = 0;
      }

      if (signals[inst.target] !== res) {
        signals[inst.target] = res;
        changed = true;
      }
    });
  }

  return signals;
}

export function buildGraphFromIR(irInstructions, ast) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  let yIn = 60;
  ast.expandedInputs.forEach((inp) => {
    const id = `in_${inp}`;
    nodes.push({
      id,
      label: inp,
      type: 'input',
      x: 50,
      y: yIn,
      gateType: 'INPUT',
    });
    nodeMap.set(inp, id);
    yIn += 75;
  });

  let xGate = 280;
  let yGate = 60;

  irInstructions.forEach((inst) => {
    if (inst.op === 'BUF' && inst.target === inst.args[0]) return;

    const id = `gate_${inst.target}`;
    nodes.push({
      id,
      label: inst.target,
      type: 'gate',
      gateType: inst.op,
      args: inst.args,
      x: xGate,
      y: yGate,
    });
    nodeMap.set(inst.target, id);

    inst.args.forEach((arg, idx) => {
      const sourceId = nodeMap.get(arg) || `in_${arg}`;
      edges.push({
        id: `e_${arg}_to_${inst.target}_${idx}`,
        source: sourceId,
        target: id,
        signal: arg,
      });
    });

    yGate += 85;
    if (yGate > 420) {
      yGate = 60;
      xGate += 210;
    }
  });

  let yOut = 60;
  ast.expandedOutputs.forEach((outp) => {
    const id = `out_${outp}`;
    const sourceId = nodeMap.get(outp) || `in_${outp}`;
    nodes.push({
      id,
      label: outp,
      type: 'output',
      x: xGate + 220,
      y: yOut,
      gateType: 'OUTPUT',
    });
    edges.push({
      id: `e_${sourceId}_to_${id}_out`,
      source: sourceId,
      target: id,
      signal: outp,
    });
    yOut += 75;
  });

  return { nodes, edges };
}
