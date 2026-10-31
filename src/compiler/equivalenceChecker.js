import { evaluateCircuitIR } from './Evaluator.js';

export function checkEquivalence(rawIR, optIR, ast) {
  const inputs = ast?.expandedInputs || [];
  const outputs = ast?.expandedOutputs || [];

  if (outputs.length === 0) {
    return {
      equivalent: true,
      counterexample: null,
      verifiedVectors: 0,
      method: 'trivial',
      message: 'No primary outputs declared',
    };
  }

  // Handle sequential circuits with DFF
  const hasSequential =
    (rawIR || []).some((i) => i.op === 'DFF') ||
    (optIR || []).some((i) => i.op === 'DFF');

  if (hasSequential) {
    // For sequential circuits, verify over structured multi-cycle sequences
    const clkPort = inputs.find((i) => i.toLowerCase().includes('clk')) || inputs[0];
    const cycles = 32;
    for (let c = 0; c < cycles; c++) {
      const vector = {};
      inputs.forEach((inp) => {
        if (inp === clkPort) {
          vector[inp] = c % 2; // toggle clock
        } else {
          vector[inp] = Math.random() > 0.5 ? 1 : 0;
        }
      });
      const rawRes = evaluateCircuitIR(rawIR, vector);
      const optRes = evaluateCircuitIR(optIR, vector);

      for (const outp of outputs) {
        if ((rawRes[outp] ?? 0) !== (optRes[outp] ?? 0)) {
          return {
            equivalent: false,
            counterexample: {
              inputs: vector,
              failingOutput: outp,
              expected: rawRes[outp] ?? 0,
              actual: optRes[outp] ?? 0,
            },
            verifiedVectors: c + 1,
            method: 'sequential-cycle',
          };
        }
      }
    }

    return {
      equivalent: true,
      counterexample: null,
      verifiedVectors: cycles,
      method: 'sequential-cycle',
    };
  }

  // Combinational Exhaustive Verification (up to 16 inputs = 65,536 vectors)
  if (inputs.length <= 16) {
    const totalComb = 1 << inputs.length;
    for (let idx = 0; idx < totalComb; idx++) {
      const vector = {};
      for (let bit = 0; bit < inputs.length; bit++) {
        vector[inputs[bit]] = (idx >> (inputs.length - 1 - bit)) & 1;
      }

      const rawRes = evaluateCircuitIR(rawIR, vector);
      const optRes = evaluateCircuitIR(optIR, vector);

      for (const outp of outputs) {
        const rawVal = rawRes[outp] ?? 0;
        const optVal = optRes[outp] ?? 0;
        if (rawVal !== optVal) {
          return {
            equivalent: false,
            counterexample: {
              inputs: vector,
              failingOutput: outp,
              expected: rawVal,
              actual: optVal,
            },
            verifiedVectors: idx + 1,
            method: 'exhaustive',
          };
        }
      }
    }

    return {
      equivalent: true,
      counterexample: null,
      verifiedVectors: totalComb,
      method: 'exhaustive',
    };
  }

  // Large Input Vectors (> 16 inputs): Structured Corner Cases + Random SAT-style check
  const testVectors = [];

  // Corner cases
  const allZeros = {};
  const allOnes = {};
  inputs.forEach((inp) => {
    allZeros[inp] = 0;
    allOnes[inp] = 1;
  });
  testVectors.push(allZeros, allOnes);

  // Walking 1s and walking 0s
  inputs.forEach((oneInp) => {
    const w1 = { ...allZeros, [oneInp]: 1 };
    const w0 = { ...allOnes, [oneInp]: 0 };
    testVectors.push(w1, w0);
  });

  // Random vectors up to 2048
  while (testVectors.length < 2048) {
    const randVec = {};
    inputs.forEach((inp) => {
      randVec[inp] = Math.random() > 0.5 ? 1 : 0;
    });
    testVectors.push(randVec);
  }

  for (let idx = 0; idx < testVectors.length; idx++) {
    const vector = testVectors[idx];
    const rawRes = evaluateCircuitIR(rawIR, vector);
    const optRes = evaluateCircuitIR(optIR, vector);

    for (const outp of outputs) {
      const rawVal = rawRes[outp] ?? 0;
      const optVal = optRes[outp] ?? 0;
      if (rawVal !== optVal) {
        return {
          equivalent: false,
          counterexample: {
            inputs: vector,
            failingOutput: outp,
            expected: rawVal,
            actual: optVal,
          },
          verifiedVectors: idx + 1,
          method: 'random-sat',
        };
      }
    }
  }

  return {
    equivalent: true,
    counterexample: null,
    verifiedVectors: testVectors.length,
    method: 'random-sat',
  };
}
