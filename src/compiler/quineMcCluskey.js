export class QuineMcCluskey {
  static minimize(varNames, minterms, dontCares = []) {
    const numVars = varNames.length;
    const allTerms = [...minterms, ...dontCares];

    if (minterms.length === 0) {
      return {
        primeImplicants: [],
        essentialImplicants: [],
        dslCode: `// Minimized circuit (constant 0)\ncircuit MinimizedCircuit {\n${varNames.map((v) => `    input ${v}: Wire;\n`).join('')}    output out: Wire;\n\n    out = 0;\n}`,
        verilogCode: `assign out = 1'b0;`,
        kmap: this.generateKMap(varNames, minterms, dontCares),
      };
    }

    if (minterms.length === (1 << numVars)) {
      return {
        primeImplicants: [],
        essentialImplicants: [],
        dslCode: `// Minimized circuit (constant 1)\ncircuit MinimizedCircuit {\n${varNames.map((v) => `    input ${v}: Wire;\n`).join('')}    output out: Wire;\n\n    out = 1;\n}`,
        verilogCode: `assign out = 1'b1;`,
        kmap: this.generateKMap(varNames, minterms, dontCares),
      };
    }

    // Step 1: Initial grouping by number of 1s
    const toBinary = (num) => num.toString(2).padStart(numVars, '0');
    let groups = new Map();

    allTerms.forEach((term) => {
      const bin = toBinary(term);
      const ones = (bin.match(/1/g) || []).length;
      if (!groups.has(ones)) groups.set(ones, []);
      groups.get(ones).push({
        mask: bin,
        minterms: [term],
        used: false,
      });
    });

    // Step 2: Iterative tabular combination
    const primeImplicants = [];

    while (groups.size > 0) {
      const nextGroups = new Map();
      const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);

      for (let i = 0; i < sortedKeys.length - 1; i++) {
        const k1 = sortedKeys[i];
        const k2 = sortedKeys[i + 1];
        if (k2 !== k1 + 1) continue;

        const g1 = groups.get(k1) || [];
        const g2 = groups.get(k2) || [];

        for (const t1 of g1) {
          for (const t2 of g2) {
            let diffCount = 0;
            let diffIndex = -1;
            for (let b = 0; b < numVars; b++) {
              if (t1.mask[b] !== t2.mask[b]) {
                diffCount++;
                diffIndex = b;
              }
            }

            if (diffCount === 1) {
              t1.used = true;
              t2.used = true;
              const combinedMask =
                t1.mask.slice(0, diffIndex) + '-' + t1.mask.slice(diffIndex + 1);
              const combinedMinterms = Array.from(
                new Set([...t1.minterms, ...t2.minterms])
              ).sort((a, b) => a - b);

              const ones = (combinedMask.match(/1/g) || []).length;
              if (!nextGroups.has(ones)) nextGroups.set(ones, []);
              const existing = nextGroups.get(ones).find((x) => x.mask === combinedMask);
              if (!existing) {
                nextGroups.get(ones).push({
                  mask: combinedMask,
                  minterms: combinedMinterms,
                  used: false,
                });
              }
            }
          }
        }
      }

      // Collect unused terms as prime implicants
      for (const group of groups.values()) {
        for (const term of group) {
          if (!term.used) {
            if (!primeImplicants.some((pi) => pi.mask === term.mask)) {
              primeImplicants.push(term);
            }
          }
        }
      }

      groups = nextGroups;
    }

    // Step 3: Prime Implicant Chart & Essential Prime Implicant Selection
    const essentialImplicants = [];
    const mintermCover = new Map(); // minterm -> array of PIs covering it

    minterms.forEach((m) => {
      mintermCover.set(m, []);
      primeImplicants.forEach((pi) => {
        if (pi.minterms.includes(m)) {
          mintermCover.get(m).push(pi);
        }
      });
    });

    // Find minterms covered by only 1 PI -> Essential PI
    const uncoveredMinterms = new Set(minterms);

    mintermCover.forEach((coveringPIs) => {
      if (coveringPIs.length === 1) {
        const epi = coveringPIs[0];
        if (!essentialImplicants.includes(epi)) {
          essentialImplicants.push(epi);
          epi.minterms.forEach((m) => uncoveredMinterms.delete(m));
        }
      }
    });

    // Greedily cover remaining minterms with remaining PIs
    while (uncoveredMinterms.size > 0) {
      let bestPI = null;
      let maxCovered = -1;

      primeImplicants.forEach((pi) => {
        if (!essentialImplicants.includes(pi)) {
          const coveredCount = pi.minterms.filter((m) => uncoveredMinterms.has(m)).length;
          if (coveredCount > maxCovered) {
            maxCovered = coveredCount;
            bestPI = pi;
          }
        }
      });

      if (bestPI && maxCovered > 0) {
        essentialImplicants.push(bestPI);
        bestPI.minterms.forEach((m) => uncoveredMinterms.delete(m));
      } else {
        break;
      }
    }

    // Generate DSL & Verilog expressions from essential implicants
    const productTerms = essentialImplicants.map((pi, idx) => {
      const literals = [];
      const verilogLiterals = [];
      for (let b = 0; b < numVars; b++) {
        const char = pi.mask[b];
        const vName = varNames[b];
        if (char === '1') {
          literals.push(vName);
          verilogLiterals.push(vName);
        } else if (char === '0') {
          literals.push(`NOT(${vName})`);
          verilogLiterals.push(`~${vName}`);
        }
      }
      return {
        pi,
        wireName: `p${idx}`,
        literals,
        verilogExpr: verilogLiterals.length === 1 ? verilogLiterals[0] : `(${verilogLiterals.join(' & ')})`,
        dslExpr:
          literals.length === 0
            ? '1'
            : literals.length === 1
            ? literals[0]
            : `AND(${literals.join(', ')})`,
      };
    });

    let dslCode = `// Quine-McCluskey Minimized Circuit\ncircuit MinimizedCircuit {\n`;
    varNames.forEach((v) => {
      dslCode += `    input ${v}: Wire;\n`;
    });
    dslCode += `    output out: Wire;\n\n`;

    if (productTerms.length === 0) {
      dslCode += `    out = 0;\n}\n`;
    } else if (productTerms.length === 1) {
      dslCode += `    out = ${productTerms[0].dslExpr};\n}\n`;
    } else {
      productTerms.forEach((pt) => {
        dslCode += `    wire ${pt.wireName}: Wire;\n`;
      });
      dslCode += `\n`;
      productTerms.forEach((pt) => {
        dslCode += `    ${pt.wireName} = ${pt.dslExpr};\n`;
      });
      dslCode += `    out = OR(${productTerms.map((pt) => pt.wireName).join(', ')});\n}\n`;
    }

    const verilogCode =
      productTerms.length === 0
        ? "assign out = 1'b0;"
        : productTerms.length === 1
        ? `assign out = ${productTerms[0].verilogExpr};`
        : `assign out = ${productTerms.map((pt) => pt.verilogExpr).join(' | ')};`;

    return {
      primeImplicants,
      essentialImplicants,
      dslCode,
      verilogCode,
      kmap: this.generateKMap(varNames, minterms, dontCares),
    };
  }

  static generateKMap(varNames, minterms, dontCares) {
    const n = varNames.length;
    if (n < 2 || n > 4) return null;

    const mintermSet = new Set(minterms);
    const dcSet = new Set(dontCares);

    const getValue = (idx) => {
      if (mintermSet.has(idx)) return '1';
      if (dcSet.has(idx)) return 'X';
      return '0';
    };

    if (n === 2) {
      const [v0, v1] = varNames;
      return {
        rowVars: [v0],
        colVars: [v1],
        rowLabels: ['0', '1'],
        colLabels: ['0', '1'],
        grid: [
          [getValue(0), getValue(1)],
          [getValue(2), getValue(3)],
        ],
      };
    }

    if (n === 3) {
      const [v0, v1, v2] = varNames;
      const grayCols = [0, 1, 3, 2]; // 00, 01, 11, 10
      return {
        rowVars: [v0],
        colVars: [v1, v2],
        rowLabels: ['0', '1'],
        colLabels: ['00', '01', '11', '10'],
        grid: [
          grayCols.map((c) => getValue(c)),
          grayCols.map((c) => getValue(4 + c)),
        ],
      };
    }

    if (n === 4) {
      const [v0, v1, v2, v3] = varNames;
      const gray = [0, 1, 3, 2];
      const grid = [];
      for (const r of gray) {
        const row = [];
        for (const c of gray) {
          const idx = (r << 2) | c;
          row.push(getValue(idx));
        }
        grid.push(row);
      }
      return {
        rowVars: [v0, v1],
        colVars: [v2, v3],
        rowLabels: ['00', '01', '11', '10'],
        colLabels: ['00', '01', '11', '10'],
        grid,
      };
    }

    return null;
  }
}
