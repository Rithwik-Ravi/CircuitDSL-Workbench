import { KNOWN_GATES } from './ASTParser.js';

export const GATE_ARITY = {
  AND: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  OR: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  XOR: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  NOT: { min: 1, max: 1, desc: 'exactly 1 input' },
  NAND: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  NOR: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  XNOR: { min: 2, max: Infinity, desc: 'at least 2 inputs' },
  BUF: { min: 1, max: 1, desc: 'exactly 1 input' },
  DFF: { min: 2, max: 3, desc: '2 or 3 inputs: (d, clk [, reset])' },
};

function levenshtein(a, b) {
  const al = a.length;
  const bl = b.length;
  const dp = Array.from({ length: bl + 1 }, (_, i) => i);

  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1].toUpperCase() === b[j - 1].toUpperCase() ? 0 : 1)
      );
      prev = temp;
    }
  }
  return dp[bl];
}

function findClosestGate(typo) {
  let closest = null;
  let minDistance = 3;
  for (const gate of KNOWN_GATES) {
    const dist = levenshtein(typo, gate);
    if (dist < minDistance) {
      minDistance = dist;
      closest = gate;
    }
  }
  return closest;
}

function findClosestSignal(name, declaredSignals) {
  let closest = null;
  let minDistance = 3;
  for (const sig of declaredSignals) {
    if (sig === '0' || sig === '1') continue;
    const dist = levenshtein(name, sig);
    if (dist < minDistance) {
      minDistance = dist;
      closest = sig;
    }
  }
  return closest;
}

export class SemanticAnalyzer {
  static analyze(ast) {
    const diagnostics = [];
    const declaredSignals = new Map();
    const busWidths = new Map();

    // Register bus declarations for bounds checking
    const allDeclGroups = [
      ...(ast.inputs || []),
      ...(ast.outputs || []),
      ...(ast.wires || []),
    ];
    allDeclGroups.forEach((decl) => {
      if (decl.width > 1) {
        busWidths.set(decl.name, decl.width);
      }
    });

    const addSignal = (meta) => {
      const name = meta.name;
      if (declaredSignals.has(name)) {
        const prev = declaredSignals.get(name);
        diagnostics.push({
          code: 'E_DUPLICATE_SIGNAL',
          severity: 'error',
          type: 'error',
          line: meta.line,
          col: meta.col,
          endLine: meta.endLine,
          endCol: meta.endCol,
          range: meta.range,
          message: `Semantic Error: Duplicate declaration of signal '${name}' (already declared as ${prev.category} on line ${prev.line})`,
          explanation: `Signals cannot be declared more than once in the same circuit scope.`,
          suggestion: `Remove the duplicate declaration or rename signal '${name}'.`,
        });
      } else {
        declaredSignals.set(name, meta);
      }
    };

    (ast.expandedInputMetas || []).forEach(addSignal);
    (ast.expandedOutputMetas || []).forEach(addSignal);
    (ast.expandedWireMetas || []).forEach(addSignal);

    declaredSignals.set('0', { category: 'const', name: '0', line: 1, col: 1 });
    declaredSignals.set('1', { category: 'const', name: '1', line: 1, col: 1 });

    const drivenSignals = new Set();
    const usedSignals = new Set();
    const declaredNamesList = Array.from(declaredSignals.keys());

    // Check expression validity: undefined signals, constants, gate arities, typos
    const checkExpression = (expr) => {
      if (!expr) return;

      if (expr.type === 'CONST') {
        if (expr.value !== 0 && expr.value !== 1) {
          diagnostics.push({
            code: 'E_INVALID_CONSTANT',
            severity: 'error',
            type: 'error',
            line: expr.line,
            col: expr.col,
            endLine: expr.endLine,
            endCol: expr.endCol,
            range: expr.range,
            message: `Semantic Error: Invalid constant literal '${expr.value}'. CircuitDSL only supports binary 0 and 1`,
            explanation: `Digital logic operates on binary domain {0, 1}.`,
            suggestion: `Change '${expr.value}' to 0 or 1.`,
          });
        }
        return;
      }

      if (expr.type === 'VAR') {
        // Check bus index bounds if applicable
        const busMatch = expr.name.match(/^([A-Za-z_]\w*)\[(\d+)\]$/);
        if (busMatch) {
          const [, base, idxStr] = busMatch;
          const idx = parseInt(idxStr, 10);
          if (busWidths.has(base)) {
            const width = busWidths.get(base);
            if (idx < 0 || idx >= width) {
              diagnostics.push({
                code: 'E_BUS_INDEX_OUT_OF_BOUNDS',
                severity: 'error',
                type: 'error',
                line: expr.line,
                col: expr.col,
                endLine: expr.endLine,
                endCol: expr.endCol,
                range: expr.range,
                message: `Semantic Error: Bus index '${idx}' out of bounds for signal '${base}' (width ${width}, valid indices [0..${width - 1}])`,
                explanation: `Referencing an index outside declared bus width produces an undefined hardware wire.`,
                suggestion: `Use an index between 0 and ${width - 1}.`,
              });
            }
          }
        }

        if (!declaredSignals.has(expr.name)) {
          const suggestion = findClosestSignal(expr.name, declaredNamesList);
          diagnostics.push({
            code: 'E_UNDEFINED_SIGNAL',
            severity: 'error',
            type: 'error',
            line: expr.line,
            col: expr.col,
            endLine: expr.endLine,
            endCol: expr.endCol,
            range: expr.range,
            message: `Semantic Error: Undefined signal reference '${expr.name}'`,
            explanation: `Signal '${expr.name}' is referenced in an expression but has not been declared.`,
            suggestion: suggestion
              ? `Did you mean '${suggestion}'? Or declare '${expr.name}' as input or wire.`
              : `Declare '${expr.name}' before referencing it.`,
          });
        } else {
          usedSignals.add(expr.name);
        }
        return;
      }

      if (expr.type === 'GATE') {
        const gateUpper = expr.gateType.toUpperCase();
        const arityInfo = GATE_ARITY[gateUpper];

        if (!arityInfo) {
          const suggestedGate = findClosestGate(expr.rawName || expr.gateType);
          diagnostics.push({
            code: 'E_UNKNOWN_GATE',
            severity: 'error',
            type: 'error',
            line: expr.line,
            col: expr.col,
            endLine: expr.endLine,
            endCol: expr.endCol,
            range: expr.range,
            message: `Semantic Error: Unknown gate '${expr.rawName || expr.gateType}'.${suggestedGate ? ` Did you mean '${suggestedGate}'?` : ''}`,
            explanation: `'${expr.rawName || expr.gateType}' is not a recognized digital logic gate or primitive.`,
            suggestion: suggestedGate
              ? `Replace with '${suggestedGate}'. Valid gates: AND, OR, XOR, NOT, NAND, NOR, XNOR, BUF, DFF.`
              : `Use a valid gate primitive: AND, OR, XOR, NOT, NAND, NOR, XNOR, BUF, DFF.`,
            fix: suggestedGate
              ? {
                  kind: 'replace-range',
                  line: expr.line,
                  startCol: expr.col,
                  endCol: expr.col + (expr.rawName || expr.gateType).length,
                  replacement: suggestedGate,
                }
              : null,
          });
        } else {
          const argCount = expr.args.length;
          if (argCount < arityInfo.min || argCount > arityInfo.max) {
            diagnostics.push({
              code: 'E_GATE_ARITY_MISMATCH',
              severity: 'error',
              type: 'error',
              line: expr.line,
              col: expr.col,
              endLine: expr.endLine,
              endCol: expr.endCol,
              range: expr.range,
              message: `Semantic Error: Gate '${gateUpper}' expects ${arityInfo.desc}, but received ${argCount} argument${argCount === 1 ? '' : 's'}`,
              explanation: `Gate '${gateUpper}' was invoked with an illegal number of arguments.`,
              suggestion: `Provide ${arityInfo.desc} to '${gateUpper}'.`,
            });
          }
        }

        expr.args.forEach((arg) => checkExpression(arg));
      }
    };

    // Analyze assignments
    (ast.assignments || []).forEach((assign) => {
      const sig = declaredSignals.get(assign.target);
      if (!sig) {
        diagnostics.push({
          code: 'E_UNDECLARED_TARGET',
          severity: 'error',
          type: 'error',
          line: assign.line,
          col: assign.col,
          endLine: assign.endLine,
          endCol: assign.endCol,
          range: assign.range,
          message: `Semantic Error: Assignment to undeclared signal '${assign.target}'`,
          explanation: `Cannot assign to '${assign.target}' because it has not been declared.`,
          suggestion: `Declare '${assign.target}' as output or wire before assigning to it.`,
        });
      } else if (sig.category === 'input') {
        diagnostics.push({
          code: 'E_DRIVE_INPUT',
          severity: 'error',
          type: 'error',
          line: assign.line,
          col: assign.col,
          endLine: assign.endLine,
          endCol: assign.endCol,
          range: assign.range,
          message: `Semantic Error: Cannot drive input signal '${assign.target}'`,
          explanation: `Primary inputs cannot be driven by internal gates or assignments.`,
          suggestion: `Remove this assignment or declare '${assign.target}' as a wire/output.`,
        });
      }

      if (drivenSignals.has(assign.target)) {
        diagnostics.push({
          code: 'E_MULTIPLE_DRIVERS',
          severity: 'error',
          type: 'error',
          line: assign.line,
          col: assign.col,
          endLine: assign.endLine,
          endCol: assign.endCol,
          range: assign.range,
          message: `Semantic Error: Signal '${assign.target}' driven by multiple sources`,
          explanation: `In standard digital logic, a wire cannot have multiple simultaneous drivers.`,
          suggestion: `Use a multiplexer or remove conflicting assignments to '${assign.target}'.`,
        });
      }
      drivenSignals.add(assign.target);

      checkExpression(assign.expr);
    });

    // Check undriven outputs and unused signals with REAL source locations
    (ast.expandedOutputMetas || []).forEach((outp) => {
      if (!drivenSignals.has(outp.name) && !ast.expandedInputs.includes(outp.name)) {
        diagnostics.push({
          code: 'W_UNDRIVEN_OUTPUT',
          severity: 'warning',
          type: 'warning',
          line: outp.line,
          col: outp.col,
          endLine: outp.endLine,
          endCol: outp.endCol,
          range: outp.range,
          message: `Semantic Warning: Primary output '${outp.name}' is undriven`,
          explanation: `Output '${outp.name}' has no gate or assignment driving its value.`,
          suggestion: `Assign a value or logic expression to '${outp.name}'.`,
        });
      }
    });

    (ast.expandedWireMetas || []).forEach((w) => {
      if (!drivenSignals.has(w.name)) {
        diagnostics.push({
          code: 'W_UNDRIVEN_WIRE',
          severity: 'warning',
          type: 'warning',
          line: w.line,
          col: w.col,
          endLine: w.endLine,
          endCol: w.endCol,
          range: w.range,
          message: `Semantic Warning: Internal wire '${w.name}' is undriven`,
          explanation: `Wire '${w.name}' is declared but never assigned a value.`,
          suggestion: `Assign a value to '${w.name}' or remove the declaration.`,
        });
      }
      if (!usedSignals.has(w.name) && !ast.expandedOutputs.includes(w.name)) {
        diagnostics.push({
          code: 'W_UNUSED_WIRE',
          severity: 'info',
          type: 'info',
          line: w.line,
          col: w.col,
          endLine: w.endLine,
          endCol: w.endCol,
          range: w.range,
          message: `Semantic Info: Signal '${w.name}' is declared but never read`,
          explanation: `Unused wires may be optimized away during synthesis.`,
          suggestion: `Verify if '${w.name}' is needed in logic.`,
        });
      }
    });

    // Combinational Loop Detection (D6)
    // Build combinational adjacency graph (paths broken by DFF are sequential, not combinational)
    const combAdj = new Map();
    const extractCombDeps = (expr, deps) => {
      if (!expr) return;
      if (expr.type === 'VAR') {
        deps.add(expr.name);
      } else if (expr.type === 'GATE') {
        // DFF breaks combinational dependency! DFF output depends on previous clock cycle state
        if (expr.gateType.toUpperCase() === 'DFF') {
          return;
        }
        expr.args.forEach((arg) => extractCombDeps(arg, deps));
      }
    };

    (ast.assignments || []).forEach((assign) => {
      const deps = new Set();
      extractCombDeps(assign.expr, deps);
      combAdj.set(assign.target, Array.from(deps));
    });

    // Detect cycles using DFS
    const visited = new Set();
    const recStack = new Set();
    const cycleNodes = [];

    const dfsCycle = (node, path) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = combAdj.get(node) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          const found = dfsCycle(next, path);
          if (found) return true;
        } else if (recStack.has(next)) {
          const cycleStartIdx = path.indexOf(next);
          const fullCycle = [...path.slice(cycleStartIdx), next];
          cycleNodes.push(fullCycle);
          return true;
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const target of combAdj.keys()) {
      if (!visited.has(target)) {
        dfsCycle(target, []);
      }
    }

    if (cycleNodes.length > 0) {
      cycleNodes.forEach((cycle) => {
        const cycleStr = cycle.join(' -> ');
        const targetNode = cycle[0];
        const assign = (ast.assignments || []).find((a) => a.target === targetNode);
        diagnostics.push({
          code: 'E_COMBINATIONAL_LOOP',
          severity: 'error',
          type: 'error',
          line: assign ? assign.line : 1,
          col: assign ? assign.col : 1,
          endLine: assign ? assign.endLine : 1,
          endCol: assign ? assign.endCol : 1,
          range: assign ? assign.range : null,
          message: `Semantic Error: Combinational loop detected in path: ${cycleStr}`,
          explanation: `Pure combinational feedback creates unstable, oscillating, or undefined logic states without a clock edge.`,
          suggestion: `Break the combinational feedback loop using a sequential element (DFF) or reorganize logic.`,
        });
      });
    }

    return diagnostics;
  }
}
