export const PRESET_EXAMPLES = {
  optimizationTest: `// README Demo: Circuit with Dead Code, CSE, and Redundant Gates
circuit OptimizationDemo {
    input a: Wire;
    input b: Wire;
    input enable: Wire;
    output out_final: Wire;

    wire dead_wire: Wire;
    wire cse_1: Wire;
    wire cse_2: Wire;
    wire const_wire: Wire;

    // 1. Dead Code: Unused wire and gate
    dead_wire = XOR(a, b);

    // 2. Common Subexpression Elimination (CSE)
    cse_1 = AND(a, b);
    cse_2 = AND(a, b);

    // 3. Constant Folding & Redundancy Simplification (OR(x, x) -> x)
    const_wire = OR(cse_1, cse_2);

    // Primary output
    out_final = AND(const_wire, enable);
}`,

  constantFoldingDemo: `// Constant Folding & Boolean Simplification Demo
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

  halfAdder: `// 1-bit Half Adder: sum and carry out
circuit HalfAdder {
    input a: Wire;
    input b: Wire;
    output sum: Wire;
    output cout: Wire;

    sum = XOR(a, b);
    cout = AND(a, b);
}`,

  fullAdder: `// 1-bit Full Adder with Carry-in
circuit FullAdder {
    input a: Wire;
    input b: Wire;
    input cin: Wire;
    output sum: Wire;
    output cout: Wire;

    wire axorb: Wire;
    wire c1: Wire;
    wire c2: Wire;

    axorb = XOR(a, b);
    sum = XOR(axorb, cin);
    c1 = AND(axorb, cin);
    c2 = AND(a, b);
    cout = OR(c1, c2);
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

  mux4to1: `// 4-to-1 Multiplexer with 2 select lines
circuit Mux4to1 {
    input d0: Wire;
    input d1: Wire;
    input d2: Wire;
    input d3: Wire;
    input s0: Wire;
    input s1: Wire;
    output y: Wire;

    wire ns0: Wire;
    wire ns1: Wire;
    wire m0: Wire;
    wire m1: Wire;
    wire m2: Wire;
    wire m3: Wire;

    ns0 = NOT(s0);
    ns1 = NOT(s1);

    m0 = AND(d0, ns1, ns0);
    m1 = AND(d1, ns1, s0);
    m2 = AND(d2, s1, ns0);
    m3 = AND(d3, s1, s0);

    y = OR(m0, m1, m2, m3);
}`,

  decoder: `// 2-to-4 Binary Line Decoder with Enable
circuit Decoder2to4 {
    input a: Wire;
    input b: Wire;
    input en: Wire;
    output y0: Wire;
    output y1: Wire;
    output y2: Wire;
    output y3: Wire;

    wire na: Wire;
    wire nb: Wire;

    na = NOT(a);
    nb = NOT(b);

    y0 = AND(en, na, nb);
    y1 = AND(en, na, b);
    y2 = AND(en, a, nb);
    y3 = AND(en, a, b);
}`,

  parity: `// 4-bit Even Parity Generator
circuit ParityGenerator4 {
    input d[4]: Wire;
    output parity: Wire;

    wire p01: Wire;
    wire p23: Wire;

    p01 = XOR(d[0], d[1]);
    p23 = XOR(d[2], d[3]);
    parity = XOR(p01, p23);
}`,

  comparator: `// 2-bit Magnitude Comparator: eq, gt, lt
circuit Comparator2bit {
    input a[2]: Wire;
    input b[2]: Wire;
    output eq: Wire;
    output gt: Wire;
    output lt: Wire;

    wire x1: Wire;
    wire x0: Wire;

    x1 = XNOR(a[1], b[1]);
    x0 = XNOR(a[0], b[0]);
    eq = AND(x1, x0);

    gt = OR(AND(a[1], NOT(b[1])), AND(x1, a[0], NOT(b[0])));
    lt = OR(AND(NOT(a[1]), b[1]), AND(x1, NOT(a[0]), b[0]));
}`,

  srLatch: `// Cross-Coupled NOR SR Latch
circuit SRLatch {
    input s: Wire;
    input r: Wire;
    output q: Wire;
    output q_not: Wire;

    // Cross-coupled NOR feedback
    q = NOR(r, q_not);
    q_not = NOR(s, q);
}`,

  dff: `// Sequential Positive-Edge D Flip-Flop with Active-High Reset
circuit DFlipFlop {
    input d: Wire;
    input clk: Wire;
    input reset: Wire;
    output q: Wire;
    output q_not: Wire;

    wire d_gated: Wire;
    d_gated = AND(d, NOT(reset));

    q = DFF(d_gated, clk, reset);
    q_not = NOT(q);
}`,

  counter3bit: `// 3-bit Synchronous Binary Counter using DFFs
circuit Counter3bit {
    input clk: Wire;
    input reset: Wire;
    output q[3]: Wire;

    wire d0: Wire;
    wire d1: Wire;
    wire d2: Wire;

    // Toggle bit 0 every clock
    d0 = NOT(q[0]);
    q[0] = DFF(d0, clk, reset);

    // Toggle bit 1 when q[0] is 1
    d1 = XOR(q[1], q[0]);
    q[1] = DFF(d1, clk, reset);

    // Toggle bit 2 when q[0] & q[1] are 1
    d2 = XOR(q[2], AND(q[0], q[1]));
    q[2] = DFF(d2, clk, reset);
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

  custom: `// Blank Circuit Scratchpad
circuit CustomCircuit {
    input a: Wire;
    input b: Wire;
    output out: Wire;

    out = AND(a, b);
}`,
};

export const PRESET_METADATA = {
  optimizationTest: { title: 'Optimization Demo', description: 'Dead code, CSE, and redundant logic reduction' },
  constantFoldingDemo: { title: 'Constant Folding', description: 'Static boolean evaluation with 0 and 1' },
  halfAdder: { title: 'Half Adder', description: '1-bit binary adder with sum and carry' },
  fullAdder: { title: 'Full Adder', description: '1-bit adder with carry-in and carry-out' },
  adder: { title: '4-Bit Ripple Adder', description: '4-bit cascaded full adders with carry propagate' },
  mux: { title: '2:1 Multiplexer', description: 'Binary data selector with 1 select bit' },
  mux4to1: { title: '4:1 Multiplexer', description: '4-channel data selector with 2-bit address' },
  decoder: { title: '2:4 Line Decoder', description: '2-bit address to 4 active-high select outputs' },
  parity: { title: '4-Bit Parity Generator', description: 'Tree of XOR gates for even parity calculation' },
  comparator: { title: '2-Bit Magnitude Comparator', description: 'Determines equality, greater than, and less than' },
  srLatch: { title: 'SR Latch', description: 'Bistable cross-coupled NOR gate memory cell' },
  dff: { title: 'D Flip-Flop', description: 'Edge-triggered sequential register with reset' },
  counter3bit: { title: '3-Bit Binary Counter', description: 'Cascaded toggle registers with carry lookahead' },
  alu: { title: '1-Bit ALU Slice', description: 'Configurable arithmetic/logic unit for AND / XOR' },
  custom: { title: 'Scratchpad', description: 'Blank canvas for designing custom digital circuits' },
};
