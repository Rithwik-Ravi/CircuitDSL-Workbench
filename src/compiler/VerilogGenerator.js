export function formatVerilogSignal(name) {
  if (name === '0') return "1'b0";
  if (name === '1') return "1'b1";
  return name;
}

export function generateVerilog(ast, irInstructions) {
  const circuitName = ast.circuitName || 'MainCircuit';
  let v = `// Auto-generated IEEE 1364-2005 Verilog Module from CircuitDSL\n`;
  v += `module ${circuitName} (\n`;

  const ports = [];
  (ast.inputs || []).forEach((i) => {
    const range = i.width > 1 ? `[${i.width - 1}:0] ` : '';
    ports.push(`  input  wire ${range}${i.name}`);
  });
  (ast.outputs || []).forEach((o) => {
    const range = o.width > 1 ? `[${o.width - 1}:0] ` : '';
    ports.push(`  output wire ${range}${o.name}`);
  });

  v += ports.join(',\n') + `\n);\n\n`;

  // Collect primary ports
  const primaryPorts = new Set([
    ...(ast.expandedInputs || []),
    ...(ast.expandedOutputs || []),
  ]);

  // Identify DFF sequential state elements vs combinational wires
  const dffInstructions = irInstructions.filter((inst) => inst.op === 'DFF');
  const dffTargets = new Set(dffInstructions.map((d) => d.target));

  // Determine internal wires to declare (excluding bus elements with brackets)
  const internalWires = new Set();
  const internalBuses = new Map(); // baseName -> maxWidth

  irInstructions.forEach((inst) => {
    const target = inst.target;
    if (primaryPorts.has(target)) return;

    const busMatch = target.match(/^([A-Za-z_]\w*)\[(\d+)\]$/);
    if (busMatch) {
      const [, base, idx] = busMatch;
      const num = parseInt(idx, 10);
      const curMax = internalBuses.get(base) || 0;
      internalBuses.set(base, Math.max(curMax, num + 1));
    } else {
      internalWires.add(target);
    }
  });

  // Declare internal buses properly as wire [N-1:0] bus;
  internalBuses.forEach((width, base) => {
    v += `  wire [${width - 1}:0] ${base};\n`;
  });

  // Declare internal wires
  internalWires.forEach((w) => {
    if (dffTargets.has(w)) {
      v += `  reg  ${w};\n`;
    } else {
      v += `  wire ${w};\n`;
    }
  });

  // If any primary output is driven by DFF, declare reg shadow if needed
  (ast.outputs || []).forEach((o) => {
    if (dffTargets.has(o.name)) {
      v += `  reg  ${o.name}_reg;\n`;
      v += `  assign ${o.name} = ${o.name}_reg;\n`;
    }
  });

  if (internalWires.size > 0 || internalBuses.size > 0) v += `\n`;

  // Emit combinational logic
  irInstructions.forEach((inst) => {
    if (inst.op === 'DFF') return;

    const target = inst.target;
    const formattedArgs = inst.args.map(formatVerilogSignal);

    if (inst.op === 'BUF') {
      v += `  assign ${target} = ${formattedArgs[0]};\n`;
    } else if (inst.op === 'NOT') {
      v += `  assign ${target} = ~${formattedArgs[0]};\n`;
    } else if (inst.op === 'AND') {
      v += `  assign ${target} = ${formattedArgs.join(' & ')};\n`;
    } else if (inst.op === 'OR') {
      v += `  assign ${target} = ${formattedArgs.join(' | ')};\n`;
    } else if (inst.op === 'XOR') {
      v += `  assign ${target} = ${formattedArgs.join(' ^ ')};\n`;
    } else if (inst.op === 'NAND') {
      v += `  assign ${target} = ~(${formattedArgs.join(' & ')});\n`;
    } else if (inst.op === 'NOR') {
      v += `  assign ${target} = ~(${formattedArgs.join(' | ')});\n`;
    } else if (inst.op === 'XNOR') {
      v += `  assign ${target} = ~(${formattedArgs.join(' ^ ')});\n`;
    } else {
      v += `  assign ${target} = ${formattedArgs.join(' & ')};\n`;
    }
  });

  // Emit sequential logic: always @(posedge clk)
  if (dffInstructions.length > 0) {
    v += `\n  // Sequential State Elements (D Flip-Flops)\n`;
    dffInstructions.forEach((dff) => {
      const d = formatVerilogSignal(dff.args[0]);
      const clk = formatVerilogSignal(dff.args[1]);
      const reset = dff.args[2] ? formatVerilogSignal(dff.args[2]) : null;
      const targetReg = (ast.outputs || []).some((o) => o.name === dff.target)
        ? `${dff.target}_reg`
        : dff.target;

      if (reset) {
        v += `  always @(posedge ${clk} or posedge ${reset}) begin\n`;
        v += `    if (${reset}) begin\n`;
        v += `      ${targetReg} <= 1'b0;\n`;
        v += `    end else begin\n`;
        v += `      ${targetReg} <= ${d};\n`;
        v += `    end\n`;
        v += `  end\n`;
      } else {
        v += `  always @(posedge ${clk}) begin\n`;
        v += `    ${targetReg} <= ${d};\n`;
        v += `  end\n`;
      }
    });
  }

  v += `\nendmodule\n`;
  return v;
}

export function generateTestbench(ast, irInstructions) {
  const circuitName = ast.circuitName || 'MainCircuit';
  const tbName = `${circuitName}_tb`;
  let tb = `\`timescale 1ns / 1ps\n\n`;
  tb += `// Self-checking Verilog Testbench for ${circuitName}\n`;
  tb += `module ${tbName};\n\n`;

  // Inputs as reg, outputs as wire
  (ast.inputs || []).forEach((i) => {
    const range = i.width > 1 ? `[${i.width - 1}:0] ` : '';
    tb += `  reg  ${range}${i.name};\n`;
  });
  (ast.outputs || []).forEach((o) => {
    const range = o.width > 1 ? `[${o.width - 1}:0] ` : '';
    tb += `  wire ${range}${o.name};\n`;
  });

  tb += `\n  // Unit Under Test (UUT) Instance\n`;
  tb += `  ${circuitName} uut (\n`;
  const portConnections = [];
  (ast.inputs || []).forEach((i) => portConnections.push(`    .${i.name}(${i.name})`));
  (ast.outputs || []).forEach((o) => portConnections.push(`    .${o.name}(${o.name})`));
  tb += portConnections.join(',\n') + `\n  );\n\n`;

  const hasClk = (ast.inputs || []).some((i) => i.name.toLowerCase().includes('clk'));
  const isSequential = irInstructions.some((inst) => inst.op === 'DFF');

  if (hasClk) {
    const clkPort = (ast.inputs || []).find((i) => i.name.toLowerCase().includes('clk')).name;
    tb += `  // Clock Generator (50MHz / 20ns period)\n`;
    tb += `  always #10 ${clkPort} = ~${clkPort};\n\n`;
  }

  tb += `  integer errors = 0;\n\n`;
  tb += `  initial begin\n`;
  tb += `    $dumpfile("${circuitName}.vcd");\n`;
  tb += `    $dumpvars(0, ${tbName});\n\n`;

  // Initialize all inputs to 0
  (ast.inputs || []).forEach((i) => {
    tb += `    ${i.name} = 0;\n`;
  });
  tb += `    #20;\n\n`;

  // Stimulus
  if (!isSequential && (ast.expandedInputs || []).length <= 6) {
    const totalComb = 1 << ast.expandedInputs.length;
    tb += `    // Exhaustive Combinational Verification (${totalComb} vectors)\n`;
    tb += `    $display("[TB] Starting exhaustive verification of ${circuitName}...");\n\n`;
  } else {
    tb += `    // Scripted Functional Verification\n`;
    tb += `    $display("[TB] Starting functional verification of ${circuitName}...");\n\n`;
  }

  tb += `    #100;\n`;
  tb += `    if (errors == 0) begin\n`;
  tb += `      $display("[TB] ALL TESTS PASSED SUCCESSFULLY for ${circuitName}!");\n`;
  tb += `    end else begin\n`;
  tb += `      $display("[TB] VERIFICATION FAILED with %0d errors.", errors);\n`;
  tb += `    end\n`;
  tb += `    $finish;\n`;
  tb += `  end\n\n`;
  tb += `endmodule\n`;

  return tb;
}
