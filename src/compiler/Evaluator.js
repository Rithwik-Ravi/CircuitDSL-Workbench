export class CircuitSimulator {
  constructor(irInstructions, ast) {
    this.ir = irInstructions || [];
    this.ast = ast || {};
    this.dffState = new Map(); // target -> current stored bit
    this.prevClk = new Map();  // clkSignal -> previous bit
    this.history = [];         // Array of { cycle, inputs, signals }
    this.currentCycle = 0;

    // Initialize DFF states to 0
    this.ir.forEach((inst) => {
      if (inst.op === 'DFF') {
        this.dffState.set(inst.target, 0);
      }
    });
  }

  reset() {
    this.dffState.clear();
    this.prevClk.clear();
    this.history = [];
    this.currentCycle = 0;
    this.ir.forEach((inst) => {
      if (inst.op === 'DFF') {
        this.dffState.set(inst.target, 0);
      }
    });
  }

  // Evaluate circuit state for given inputs
  step(inputs) {
    const signals = { ...inputs, '0': 0, '1': 1 };

    // 1. Detect clock edges and update DFF state on posedge
    this.ir.forEach((inst) => {
      if (inst.op === 'DFF') {
        const [dSignal, clkSignal, resetSignal] = inst.args;
        const curClk = signals[clkSignal] ?? 0;
        const lastClk = this.prevClk.get(clkSignal) ?? 0;
        const isPosedge = lastClk === 0 && curClk === 1;

        const isReset = resetSignal ? (signals[resetSignal] ?? 0) === 1 : false;

        if (isReset) {
          this.dffState.set(inst.target, 0);
        } else if (isPosedge) {
          // If dSignal is a combinational expression, evaluate it with current inputs
          let dVal = signals[dSignal];
          if (dVal === undefined) {
            dVal = 0;
          }
          this.dffState.set(inst.target, dVal);
        }

        this.prevClk.set(clkSignal, curClk);
      }
    });

    // 2. Set DFF output signals to updated state
    this.ir.forEach((inst) => {
      if (inst.op === 'DFF') {
        signals[inst.target] = this.dffState.get(inst.target) ?? 0;
      }
    });

    // 3. Evaluate combinational logic in topological order
    const evaluated = new Set([...Object.keys(signals)]);
    const combInsts = this.ir.filter((inst) => inst.op !== 'DFF');

    let progress = true;
    let passes = 0;
    const maxPasses = combInsts.length + 2;

    while (progress && passes < maxPasses) {
      progress = false;
      passes++;

      combInsts.forEach((inst) => {
        const canEval = inst.args.every((a) => a in signals);
        if (!canEval) return;

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
          evaluated.add(inst.target);
          progress = true;
        }
      });
    }

    const record = {
      cycle: this.currentCycle++,
      inputs: { ...inputs },
      signals: { ...signals },
    };
    this.history.push(record);

    return signals;
  }
}

export function evaluateCircuitIR(irInstructions, inputs) {
  const sim = new CircuitSimulator(irInstructions);
  return sim.step(inputs);
}

export function buildGraphFromIR(irInstructions, ast) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const inputs = ast?.expandedInputs || [];
  const outputs = ast?.expandedOutputs || [];

  let yIn = 60;
  inputs.forEach((inp) => {
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

  (irInstructions || []).forEach((inst) => {
    if (inst.op === 'BUF' && inst.target === inst.args[0]) return;

    const id = `gate_${inst.target}`;
    nodes.push({
      id,
      label: inst.target,
      type: 'gate',
      gateType: inst.op,
      args: inst.args,
      isSequential: inst.isSequential || inst.op === 'DFF',
      x: xGate,
      y: yGate,
    });
    nodeMap.set(inst.target, id);

    inst.args.forEach((arg, idx) => {
      if (arg === '0' || arg === '1') {
        const constId = `const_${arg}_${inst.target}_${idx}`;
        nodes.push({
          id: constId,
          label: arg,
          type: 'const',
          gateType: 'CONST',
          x: xGate - 100,
          y: yGate + (idx * 20),
        });
        edges.push({
          id: `e_${constId}_to_${id}`,
          source: constId,
          target: id,
          signal: arg,
        });
      } else {
        const sourceId = nodeMap.get(arg) || `in_${arg}`;
        edges.push({
          id: `e_${arg}_to_${inst.target}_${idx}`,
          source: sourceId,
          target: id,
          signal: arg,
        });
      }
    });

    yGate += 85;
    if (yGate > 460) {
      yGate = 60;
      xGate += 220;
    }
  });

  let yOut = 60;
  outputs.forEach((outp) => {
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
