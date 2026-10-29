export const PRESET_EXAMPLES = {
  optimizationTest: `// Circuit with Dead Code, CSE, and Redundant Gates
circuit OptimizationDemo {
    input a: Wire;
    input b: Wire;
    input enable: Wire;
    output out_final: Wire;

    wire dead_wire: Wire;
    wire cse_1: Wire;
    wire cse_2: Wire;
    wire const_wire: Wire;

    // 1. Dead Code (Unused wire and gate)
    dead_wire = XOR(a, b);

    // 2. Common Subexpression Elimination (CSE)
    cse_1 = AND(a, b);
    cse_2 = AND(a, b);

    // 3. Constant Folding & Redundancy Simplification (OR(x, x) -> x)
    const_wire = OR(cse_1, cse_2);

    // Primary output
    out_final = AND(const_wire, enable);
}`,

  constantFoldingDemo: `// Demo: Constant Folding & Boolean Simplification
circuit ConstantFoldingDemo {
    input in_a: Wire;
    input in_b: Wire;
    output out_val: Wire;

    wire w_zero: Wire;
    wire w_pass: Wire;

    // Logic with constant signals
    w_zero = AND(in_a, 0); // Folds to constant 0
    w_pass = OR(in_b, 0);  // Folds to buffer pass-through
    out_val = XOR(w_zero, w_pass);
}`,

  adder: `// 4-bit Ripple Carry Adder
circuit RippleCarryAdder {
    input a[4]: Wire;
    input b[4]: Wire;
    input cin: Wire;
    output sum[4]: Wire;
    output cout: Wire;

    wire c1: Wire;
    wire c2: Wire;
    wire c3: Wire;

    // Full Adder 0
    sum[0] = XOR(XOR(a[0], b[0]), cin);
    c1 = OR(AND(a[0], b[0]), AND(XOR(a[0], b[0]), cin));

    // Full Adder 1
    sum[1] = XOR(XOR(a[1], b[1]), c1);
    c2 = OR(AND(a[1], b[1]), AND(XOR(a[1], b[1]), c1));

    // Full Adder 2
    sum[2] = XOR(XOR(a[2], b[2]), c2);
    c3 = OR(AND(a[2], b[2]), AND(XOR(a[2], b[2]), c2));

    // Full Adder 3
    sum[3] = XOR(XOR(a[3], b[3]), c3);
    cout = OR(AND(a[3], b[3]), AND(XOR(a[3], b[3]), c3));
}`,

  mux: `// 2-to-1 Multiplexer with Enable Logic
circuit Mux2to1 {
    input in0: Wire;
    input in1: Wire;
    input sel: Wire;
    output out: Wire;

    wire not_sel: Wire;
    wire w0: Wire;
    wire w1: Wire;

    not_sel = NOT(sel);
    w0 = AND(in0, not_sel);
    w1 = AND(in1, sel);
    out = OR(w0, w1);
}`,

  alu: `// 1-bit Simple Arithmetic Logic Unit (ALU)
circuit SimpleALU {
    input a: Wire;
    input b: Wire;
    input op: Wire; // 0: AND, 1: ADD/XOR
    output result: Wire;

    wire and_res: Wire;
    wire xor_res: Wire;
    wire not_op: Wire;
    wire w_and: Wire;
    wire w_xor: Wire;

    and_res = AND(a, b);
    xor_res = XOR(a, b);

    not_op = NOT(op);
    w_and = AND(and_res, not_op);
    w_xor = AND(xor_res, op);

    result = OR(w_and, w_xor);
}`,

  dff: `// Sequential D Flip-Flop
circuit DFlipFlop {
    input d: Wire;
    input clk: Wire;
    input reset: Wire;
    output q: Wire;
    output q_not: Wire;

    wire n_reset: Wire;
    wire d_gated: Wire;

    n_reset = NOT(reset);
    d_gated = AND(d, n_reset);

    q = DFF(d_gated, clk);
    q_not = NOT(q);
}`,

  custom: `// Blank Circuit Scratchpad
circuit CustomCircuit {
    input a: Wire;
    input b: Wire;
    output out: Wire;

    out = AND(a, b);
}`,
};
