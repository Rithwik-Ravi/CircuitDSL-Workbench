import { TOKEN_TYPES } from './Lexer.js';

export const KNOWN_GATES = [
  'AND',
  'OR',
  'XOR',
  'NOT',
  'NAND',
  'NOR',
  'XNOR',
  'BUF',
  'DFF',
];

export class ASTParser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.pos = 0;
    this.diagnostics = [];
  }

  peek(offset = 0) {
    const idx = this.pos + offset;
    return idx < this.tokens.length
      ? this.tokens[idx]
      : { type: TOKEN_TYPES.EOF, value: null, line: 1, col: 1, endLine: 1, endCol: 1 };
  }

  consume(expectedValue = null) {
    const current = this.peek();
    if (expectedValue !== null && current.value !== expectedValue) {
      this.diagnostics.push({
        code: 'E_SYNTAX_EXPECTED',
        severity: 'error',
        type: 'error',
        line: current.line || 1,
        col: current.col || 1,
        endLine: current.endLine || current.line || 1,
        endCol: current.endCol || (current.col ? current.col + 1 : 2),
        range: current.range || {
          startLine: current.line || 1,
          startCol: current.col || 1,
          endLine: current.endLine || 1,
          endCol: current.endCol || 2,
        },
        message: `Syntax Error: Expected '${expectedValue}' but found '${current.value || 'EOF'}'`,
        explanation: `The compiler expected token '${expectedValue}' at this position.`,
        suggestion: `Insert '${expectedValue}' before '${current.value || 'EOF'}'.`,
      });
      return current;
    }
    this.pos++;
    return current;
  }

  synchronize() {
    while (this.peek().type !== TOKEN_TYPES.EOF) {
      if (this.peek().value === ';') {
        this.pos++;
        return;
      }
      if (this.peek().value === '}') {
        return;
      }
      if (
        this.peek().type === TOKEN_TYPES.KEYWORD &&
        ['input', 'output', 'wire', 'circuit', 'module'].includes(this.peek().value)
      ) {
        return;
      }
      this.pos++;
    }
  }

  parse() {
    let circuitName = 'MainCircuit';
    const inputs = [];
    const outputs = [];
    const wires = [];
    const assignments = [];
    const modules = [];

    while (this.peek().type !== TOKEN_TYPES.EOF) {
      const tok = this.peek();

      // Circuit or Module header
      if (tok.value === 'circuit' || tok.value === 'module') {
        const headerKind = this.consume().value;
        const nameTok = this.peek();
        let name = 'MainCircuit';
        if (nameTok.type === TOKEN_TYPES.IDENTIFIER) {
          name = this.consume().value;
        } else {
          this.diagnostics.push({
            code: 'E_MISSING_CIRCUIT_NAME',
            severity: 'error',
            type: 'error',
            line: tok.line,
            col: tok.col,
            endLine: tok.endLine,
            endCol: tok.endCol,
            range: tok.range,
            message: `Syntax Error: Expected ${headerKind} name identifier after '${headerKind}'`,
            explanation: `Each ${headerKind} declaration must have a unique identifier name.`,
            suggestion: `Add a valid identifier name, e.g., '${headerKind} MyCircuit { ... }'`,
          });
        }
        circuitName = name;
        if (this.peek().value === '{') {
          this.consume('{');
        } else {
          this.diagnostics.push({
            code: 'E_MISSING_LBRACE',
            severity: 'error',
            type: 'error',
            line: tok.line,
            col: tok.col,
            endLine: tok.endLine,
            endCol: tok.endCol,
            range: tok.range,
            message: `Syntax Error: Expected '{' after ${headerKind} declaration`,
            explanation: `The body of a ${headerKind} must be enclosed in curly braces.`,
            suggestion: `Add '{' to open the ${headerKind} block.`,
          });
        }
        continue;
      }

      // Signal Declarations: input, output, wire
      if (['input', 'output', 'wire'].includes(tok.value)) {
        const declTok = this.consume();
        const declType = declTok.value;
        const nameTok = this.peek();
        let name = 'sig';

        if (nameTok.type === TOKEN_TYPES.IDENTIFIER) {
          name = this.consume().value;
        } else {
          this.diagnostics.push({
            code: 'E_EXPECTED_SIGNAL_NAME',
            severity: 'error',
            type: 'error',
            line: declTok.line,
            col: declTok.col,
            endLine: declTok.endLine,
            endCol: declTok.endCol,
            range: declTok.range,
            message: `Syntax Error: Expected signal identifier after '${declType}'`,
            explanation: `Declarations must specify a name for the declared signal.`,
            suggestion: `Provide a valid identifier, e.g. '${declType} a: Wire;'`,
          });
          this.synchronize();
          continue;
        }

        let width = 1;
        if (this.peek().value === '[') {
          this.consume('[');
          const widthTok = this.peek();
          if (widthTok.type === TOKEN_TYPES.NUMBER) {
            width = this.consume().value;
          } else {
            this.diagnostics.push({
              code: 'E_INVALID_BUS_WIDTH',
              severity: 'error',
              type: 'error',
              line: widthTok.line,
              col: widthTok.col,
              endLine: widthTok.endLine,
              endCol: widthTok.endCol,
              range: widthTok.range,
              message: `Syntax Error: Expected integer bus width inside '[]'`,
              explanation: `Bus declarations require a positive integer size.`,
              suggestion: `Specify an integer width, e.g. '[4]'`,
            });
          }
          if (this.peek().value === ']') {
            this.consume(']');
          } else {
            this.diagnostics.push({
              code: 'E_MISSING_RBRACKET',
              severity: 'error',
              type: 'error',
              line: this.peek().line,
              col: this.peek().col,
              endLine: this.peek().endLine,
              endCol: this.peek().endCol,
              range: this.peek().range,
              message: `Syntax Error: Missing closing ']' in bus declaration`,
              explanation: `Bus width declarations must be enclosed by matching '[' and ']'.`,
              suggestion: `Add ']' after the bus width.`,
            });
          }
        }

        // Optional type annotation: ': Wire'
        if (this.peek().value === ':') {
          this.consume(':');
          if (this.peek().value === 'Wire' || this.peek().value === 'wire') {
            this.consume();
          }
        }

        // Semicolon handling with warning & auto-fix if missing
        if (this.peek().value === ';') {
          this.consume(';');
        } else {
          this.diagnostics.push({
            code: 'W_MISSING_SEMICOLON',
            severity: 'warning',
            type: 'warning',
            line: declTok.line,
            col: nameTok.endCol || nameTok.col + 1,
            endLine: declTok.line,
            endCol: (nameTok.endCol || nameTok.col + 1) + 1,
            range: {
              startLine: declTok.line,
              startCol: nameTok.endCol || nameTok.col + 1,
              endLine: declTok.line,
              endCol: (nameTok.endCol || nameTok.col + 1) + 1,
            },
            message: `Syntax Warning: Missing semicolon after ${declType} declaration '${name}'`,
            explanation: `Statements in CircuitDSL should terminate with a semicolon ';'.`,
            suggestion: `Add ';' at the end of the line.`,
            fix: {
              kind: 'insert-text',
              line: declTok.line,
              col: nameTok.endCol || nameTok.col + 1,
              replacement: ';',
            },
          });
        }

        const signalObj = {
          name,
          width,
          category: declType,
          line: declTok.line,
          col: declTok.col,
          endLine: nameTok.endLine || declTok.endLine,
          endCol: nameTok.endCol || declTok.endCol,
          range: {
            startLine: declTok.line,
            startCol: declTok.col,
            endLine: nameTok.endLine || declTok.endLine,
            endCol: nameTok.endCol || declTok.endCol,
          },
        };

        if (declType === 'input') inputs.push(signalObj);
        else if (declType === 'output') outputs.push(signalObj);
        else wires.push(signalObj);

        continue;
      }

      // Assignments: target = expr;
      if (tok.type === TOKEN_TYPES.IDENTIFIER) {
        const targetTok = this.consume();
        let target = targetTok.value;
        let targetIndex = null;

        if (this.peek().value === '[') {
          this.consume('[');
          const idxTok = this.peek();
          if (idxTok.type === TOKEN_TYPES.NUMBER) {
            targetIndex = this.consume().value;
          }
          if (this.peek().value === ']') {
            this.consume(']');
          }
        }

        if (this.peek().value === '=') {
          this.consume('=');
        } else {
          this.diagnostics.push({
            code: 'E_EXPECTED_EQUALS',
            severity: 'error',
            type: 'error',
            line: targetTok.line,
            col: targetTok.col,
            endLine: targetTok.endLine,
            endCol: targetTok.endCol,
            range: targetTok.range,
            message: `Syntax Error: Expected '=' in assignment to '${target}'`,
            explanation: `Signal assignments require '=' between the target signal and expression.`,
            suggestion: `Add '=' after '${target}'.`,
          });
          this.synchronize();
          continue;
        }

        const expr = this.parseExpression();

        if (this.peek().value === ';') {
          this.consume(';');
        } else {
          this.diagnostics.push({
            code: 'W_MISSING_SEMICOLON',
            severity: 'warning',
            type: 'warning',
            line: targetTok.line,
            col: this.peek().col,
            endLine: targetTok.line,
            endCol: this.peek().col + 1,
            range: {
              startLine: targetTok.line,
              startCol: this.peek().col,
              endLine: targetTok.line,
              endCol: this.peek().col + 1,
            },
            message: `Syntax Warning: Missing semicolon after assignment to '${target}'`,
            explanation: `Assignments should terminate with a semicolon ';'.`,
            suggestion: `Add ';' at the end of the assignment.`,
            fix: {
              kind: 'insert-text',
              line: targetTok.line,
              col: this.peek().col,
              replacement: ';',
            },
          });
        }

        const fullTarget =
          targetIndex !== null ? `${target}[${targetIndex}]` : target;
        assignments.push({
          target: fullTarget,
          baseTarget: target,
          targetIndex,
          expr,
          line: targetTok.line,
          col: targetTok.col,
          endLine: expr.endLine || targetTok.endLine,
          endCol: expr.endCol || targetTok.endCol,
          range: {
            startLine: targetTok.line,
            startCol: targetTok.col,
            endLine: expr.endLine || targetTok.endLine,
            endCol: expr.endCol || targetTok.endCol,
          },
        });
        continue;
      }

      // Closing brace of circuit
      if (tok.value === '}') {
        this.consume('}');
        continue;
      }

      // Stray tokens: report and recover
      this.diagnostics.push({
        code: 'E_UNEXPECTED_TOKEN',
        severity: 'error',
        type: 'error',
        line: tok.line,
        col: tok.col,
        endLine: tok.endLine,
        endCol: tok.endCol,
        range: tok.range,
        message: `Syntax Error: Unexpected token '${tok.value}' in circuit body`,
        explanation: `The token '${tok.value}' is not valid here.`,
        suggestion: `Remove or correct '${tok.value}'.`,
      });
      this.consume();
    }

    const expandSignalsWithMeta = (list) => {
      const res = [];
      list.forEach((s) => {
        if (s.width > 1) {
          for (let i = 0; i < s.width; i++) {
            res.push({
              name: `${s.name}[${i}]`,
              baseName: s.name,
              index: i,
              category: s.category,
              line: s.line,
              col: s.col,
              endLine: s.endLine,
              endCol: s.endCol,
              range: s.range,
            });
          }
        } else {
          res.push({
            name: s.name,
            baseName: s.name,
            index: null,
            category: s.category,
            line: s.line,
            col: s.col,
            endLine: s.endLine,
            endCol: s.endCol,
            range: s.range,
          });
        }
      });
      return res;
    };

    const expandedInputMetas = expandSignalsWithMeta(inputs);
    const expandedOutputMetas = expandSignalsWithMeta(outputs);
    const expandedWireMetas = expandSignalsWithMeta(wires);

    return {
      ast: {
        circuitName,
        inputs,
        outputs,
        wires,
        assignments,
        modules,
        expandedInputMetas,
        expandedOutputMetas,
        expandedWireMetas,
        expandedInputs: expandedInputMetas.map((s) => s.name),
        expandedOutputs: expandedOutputMetas.map((s) => s.name),
        expandedWires: expandedWireMetas.map((s) => s.name),
      },
      diagnostics: this.diagnostics,
    };
  }

  parseExpression() {
    const tok = this.peek();

    // Check if token is an identifier followed by '(' -> gate or module call
    if (tok.type === TOKEN_TYPES.IDENTIFIER && this.peek(1).value === '(') {
      const gateTok = this.consume();
      const gateType = gateTok.value.toUpperCase();
      this.consume('(');
      const args = [];

      while (this.peek().value !== ')' && this.peek().type !== TOKEN_TYPES.EOF) {
        args.push(this.parseExpression());
        if (this.peek().value === ',') {
          this.consume(',');
        } else if (this.peek().value !== ')' && this.peek().type !== TOKEN_TYPES.EOF) {
          this.diagnostics.push({
            code: 'E_EXPECTED_COMMA',
            severity: 'error',
            type: 'error',
            line: this.peek().line,
            col: this.peek().col,
            endLine: this.peek().endLine,
            endCol: this.peek().endCol,
            range: this.peek().range,
            message: `Syntax Error: Expected ',' between gate arguments`,
            explanation: `Arguments in gate invocations must be comma-separated.`,
            suggestion: `Insert ',' between arguments.`,
          });
        }
      }

      const closeParenTok = this.peek().value === ')' ? this.consume(')') : tok;

      return {
        type: 'GATE',
        gateType,
        rawName: gateTok.value,
        args,
        line: gateTok.line,
        col: gateTok.col,
        endLine: closeParenTok.endLine || gateTok.endLine,
        endCol: closeParenTok.endCol || gateTok.endCol + 1,
        range: {
          startLine: gateTok.line,
          startCol: gateTok.col,
          endLine: closeParenTok.endLine || gateTok.endLine,
          endCol: closeParenTok.endCol || gateTok.endCol + 1,
        },
      };
    }

    // Parenthesized expression: (expr)
    if (tok.value === '(') {
      this.consume('(');
      const subExpr = this.parseExpression();
      this.consume(')');
      return subExpr;
    }

    // Number constant: 0 or 1
    if (tok.type === TOKEN_TYPES.NUMBER) {
      const numTok = this.consume();
      return {
        type: 'CONST',
        value: numTok.value,
        line: numTok.line,
        col: numTok.col,
        endLine: numTok.endLine,
        endCol: numTok.endCol,
        range: numTok.range,
      };
    }

    // Variable reference: sig or sig[idx]
    if (tok.type === TOKEN_TYPES.IDENTIFIER) {
      const idTok = this.consume();
      let name = idTok.value;
      let endCol = idTok.endCol;

      if (this.peek().value === '[') {
        this.consume('[');
        const idxTok = this.consume();
        if (this.peek().value === ']') {
          const rBracket = this.consume(']');
          name += `[${idxTok.value}]`;
          endCol = rBracket.endCol;
        }
      }

      return {
        type: 'VAR',
        name,
        line: idTok.line,
        col: idTok.col,
        endLine: idTok.endLine,
        endCol,
        range: {
          startLine: idTok.line,
          startCol: idTok.col,
          endLine: idTok.endLine,
          endCol,
        },
      };
    }

    // Fallback: syntax error
    this.diagnostics.push({
      code: 'E_UNEXPECTED_EXPR_TOKEN',
      severity: 'error',
      type: 'error',
      line: tok.line || 1,
      col: tok.col || 1,
      endLine: tok.endLine || 1,
      endCol: tok.endCol || 2,
      range: tok.range || {
        startLine: tok.line || 1,
        startCol: tok.col || 1,
        endLine: tok.endLine || 1,
        endCol: tok.endCol || 2,
      },
      message: `Syntax Error: Unexpected expression token '${tok.value}'`,
      explanation: `Expected a gate call, signal name, or constant 0/1.`,
      suggestion: `Check the expression syntax.`,
    });
    this.consume();
    return {
      type: 'CONST',
      value: 0,
      line: tok.line || 1,
      col: tok.col || 1,
      endLine: tok.endLine || 1,
      endCol: tok.endCol || 2,
    };
  }
}
