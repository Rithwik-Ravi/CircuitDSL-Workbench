export function mapToNandOnly(irInstructions) {
  const result = [];
  let tempId = 1;
  const getTemp = () => `_nand_t${tempId++}`;

  (irInstructions || []).forEach((inst) => {
    if (inst.op === 'BUF') {
      result.push(inst);
      return;
    }

    if (inst.op === 'NOT') {
      const a = inst.args[0];
      result.push({
        target: inst.target,
        op: 'NAND',
        args: [a, a],
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'NAND') {
      result.push(inst);
      return;
    }

    if (inst.op === 'AND') {
      const nandIntermediate = getTemp();
      result.push({
        target: nandIntermediate,
        op: 'NAND',
        args: [...inst.args],
        isTemporary: true,
      });
      result.push({
        target: inst.target,
        op: 'NAND',
        args: [nandIntermediate, nandIntermediate],
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'OR') {
      const notArgs = inst.args.map((arg) => {
        const notT = getTemp();
        result.push({
          target: notT,
          op: 'NAND',
          args: [arg, arg],
          isTemporary: true,
        });
        return notT;
      });
      result.push({
        target: inst.target,
        op: 'NAND',
        args: notArgs,
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'NOR') {
      const orOut = getTemp();
      const notArgs = inst.args.map((arg) => {
        const notT = getTemp();
        result.push({
          target: notT,
          op: 'NAND',
          args: [arg, arg],
          isTemporary: true,
        });
        return notT;
      });
      result.push({
        target: orOut,
        op: 'NAND',
        args: notArgs,
        isTemporary: true,
      });
      result.push({
        target: inst.target,
        op: 'NAND',
        args: [orOut, orOut],
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'XOR' && inst.args.length === 2) {
      const [a, b] = inst.args;
      const n1 = getTemp();
      const n2 = getTemp();
      const n3 = getTemp();
      result.push({ target: n1, op: 'NAND', args: [a, b], isTemporary: true });
      result.push({ target: n2, op: 'NAND', args: [a, n1], isTemporary: true });
      result.push({ target: n3, op: 'NAND', args: [b, n1], isTemporary: true });
      result.push({ target: inst.target, op: 'NAND', args: [n2, n3], isTemporary: inst.isTemporary });
      return;
    }

    // Default fallback
    result.push(inst);
  });

  return result;
}

export function mapToNorOnly(irInstructions) {
  const result = [];
  let tempId = 1;
  const getTemp = () => `_nor_t${tempId++}`;

  (irInstructions || []).forEach((inst) => {
    if (inst.op === 'BUF') {
      result.push(inst);
      return;
    }

    if (inst.op === 'NOT') {
      const a = inst.args[0];
      result.push({
        target: inst.target,
        op: 'NOR',
        args: [a, a],
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'NOR') {
      result.push(inst);
      return;
    }

    if (inst.op === 'OR') {
      const norIntermediate = getTemp();
      result.push({
        target: norIntermediate,
        op: 'NOR',
        args: [...inst.args],
        isTemporary: true,
      });
      result.push({
        target: inst.target,
        op: 'NOR',
        args: [norIntermediate, norIntermediate],
        isTemporary: inst.isTemporary,
      });
      return;
    }

    if (inst.op === 'AND') {
      const notArgs = inst.args.map((arg) => {
        const notT = getTemp();
        result.push({
          target: notT,
          op: 'NOR',
          args: [arg, arg],
          isTemporary: true,
        });
        return notT;
      });
      result.push({
        target: inst.target,
        op: 'NOR',
        args: notArgs,
        isTemporary: inst.isTemporary,
      });
      return;
    }

    // Default fallback
    result.push(inst);
  });

  return result;
}
