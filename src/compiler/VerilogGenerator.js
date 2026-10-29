export function generateVerilog(ast, irInstructions) {
  const { circuitName, inputs, outputs } = ast;
  let v = `// Auto-generated Verilog Module from Circuit DSL\nmodule ${circuitName} (\n`;

  const ports = [];
  inputs.forEach((i) =>
    ports.push(
      `  input  wire ${i.width > 1 ? `[${i.width - 1}:0] ` : ''}${i.name}`
    )
  );
  outputs.forEach((o) =>
    ports.push(
      `  output wire ${o.width > 1 ? `[${o.width - 1}:0] ` : ''}${o.name}`
    )
  );
  v += ports.join(',\n') + `\n);\n\n`;

  const assignedTargets = new Set([
    ...ast.expandedInputs,
    ...ast.expandedOutputs,
  ]);
  const internalWires = [];

  irInstructions.forEach((inst) => {
    if (
      !assignedTargets.has(inst.target) &&
      !internalWires.includes(inst.target)
    ) {
      internalWires.push(inst.target);
    }
  });

  internalWires.forEach((w) => {
    v += `  wire ${w};\n`;
  });
  if (internalWires.length > 0) v += `\n`;

  irInstructions.forEach((inst) => {
    if (inst.op === 'BUF') {
      v += `  assign ${inst.target} = ${inst.args[0]};\n`;
    } else {
      const opMap = {
        AND: '&',
        OR: '|',
        XOR: '^',
        NOT: '~',
        NAND: '~&',
        NOR: '~|',
        XNOR: '~^',
      };
      const opSymbol = opMap[inst.op] || '&';
      if (inst.op === 'NOT') {
        v += `  assign ${inst.target} = ~${inst.args[0]};\n`;
      } else {
        v += `  assign ${inst.target} = ${inst.args.join(` ${opSymbol} `)};\n`;
      }
    }
  });

  v += `\nendmodule\n`;
  return v;
}
