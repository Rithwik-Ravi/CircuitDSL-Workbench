import { TOKEN_TYPES } from './Lexer.js';

export class ASTParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.diagnostics = [];
  }

  peek() {
    return this.tokens[this.pos] || { type: TOKEN_TYPES.EOF };
  }

  consume(expectedValue = null) {
    const current = this.peek();
    if (expectedValue && current.value !== expectedValue) {
      this.diagnostics.push({
        type: 'error',
        line: current.line || 1,
        col: current.col || 1,
        message: `Syntax Error: Expected '${expectedValue}' but found '${current.value || 'EOF'}'`,
      });
    }
    this.pos++;
    return current;
  }

  parse() {
    let circuitName = 'MainCircuit';
    const inputs = [];
    const outputs = [];
    const wires = [];
    const assignments = [];

    while (this.peek().type !== TOKEN_TYPES.EOF) {
      const tok = this.peek();

      if (tok.value === 'circuit') {
        this.consume('circuit');
        const nameTok = this.peek();
        if (nameTok.type === TOKEN_TYPES.IDENTIFIER) {
          circuitName = this.consume().value;
        }
        if (this.peek().value === '{') this.consume('{');
        continue;
      }

      if (['input', 'output', 'wire'].includes(tok.value)) {
        const declType = this.consume().value;
        const nameTok = this.peek();
        let name = 'sig';
        if (nameTok.type === TOKEN_TYPES.IDENTIFIER) {
          name = this.consume().value;
        } else {
          this.diagnostics.push({
            type: 'error',
            line: tok.line,
            col: tok.col,
            message: `Syntax Error: Expected signal identifier after '${declType}'`,
          });
        }

        let width = 1;
        if (this.peek().value === '[') {
          this.consume('[');
          width = this.consume().value;
          this.consume(']');
        }

        if (this.peek().value === ':') this.consume(':');
        if (this.peek().value === 'Wire') this.consume('Wire');
        if (this.peek().value === ';') this.consume(';');

        const signalObj = { name, width, line: tok.line, col: tok.col };
        if (declType === 'input') inputs.push(signalObj);
        else if (declType === 'output') outputs.push(signalObj);
        else wires.push(signalObj);

        continue;
      }

      if (tok.type === TOKEN_TYPES.IDENTIFIER) {
        const targetTok = this.consume();
        let target = targetTok.value;
        let targetIndex = null;

        if (this.peek().value === '[') {
          this.consume('[');
          targetIndex = this.consume().value;
          this.consume(']');
        }

        if (this.peek().value === '=') {
          this.consume('=');
        } else {
          this.diagnostics.push({
            type: 'error',
            line: targetTok.line,
            col: targetTok.col,
            message: `Syntax Error: Expected '=' in assignment to '${target}'`,
          });
        }

        const expr = this.parseExpression();

        if (this.peek().value === ';') this.consume(';');

        const fullTarget =
          targetIndex !== null ? `${target}[${targetIndex}]` : target;
        assignments.push({
          target: fullTarget,
          expr,
          line: targetTok.line,
          col: targetTok.col,
        });
        continue;
      }

      if (tok.value === '}') {
        this.consume('}');
        continue;
      }

      this.consume();
    }

    const expandSignals = (list) => {
      const res = [];
      list.forEach((s) => {
        if (s.width > 1) {
          for (let i = 0; i < s.width; i++) res.push(`${s.name}[${i}]`);
        } else res.push(s.name);
      });
      return res;
    };

    return {
      ast: {
        circuitName,
        inputs,
        outputs,
        wires,
        assignments,
        expandedInputs: expandSignals(inputs),
        expandedOutputs: expandSignals(outputs),
        expandedWires: expandSignals(wires),
      },
      diagnostics: this.diagnostics,
    };
  }

  parseExpression() {
    const tok = this.peek();

    if (
      tok.type === TOKEN_TYPES.IDENTIFIER &&
      ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR', 'BUF', 'DFF'].includes(
        tok.value.toUpperCase()
      )
    ) {
      const gateType = this.consume().value.toUpperCase();
      this.consume('(');
      const args = [];
      while (
        this.peek().value !== ')' &&
        this.peek().type !== TOKEN_TYPES.EOF
      ) {
        args.push(this.parseExpression());
        if (this.peek().value === ',') this.consume(',');
      }
      this.consume(')');
      return { type: 'GATE', gateType, args, line: tok.line, col: tok.col };
    }

    if (tok.value === '(') {
      this.consume('(');
      const subExpr = this.parseExpression();
      this.consume(')');
      return subExpr;
    }

    if (tok.type === TOKEN_TYPES.NUMBER) {
      const numTok = this.consume();
      return {
        type: 'CONST',
        value: numTok.value,
        line: numTok.line,
        col: numTok.col,
      };
    }

    if (tok.type === TOKEN_TYPES.IDENTIFIER) {
      const idTok = this.consume();
      let name = idTok.value;
      if (this.peek().value === '[') {
        this.consume('[');
        const idx = this.consume().value;
        this.consume(']');
        name += `[${idx}]`;
      }
      return { type: 'VAR', name, line: idTok.line, col: idTok.col };
    }

    this.diagnostics.push({
      type: 'error',
      line: tok.line || 1,
      col: tok.col || 1,
      message: `Syntax Error: Unexpected expression token '${tok.value}'`,
    });
    this.consume();
    return { type: 'CONST', value: 0 };
  }
}
