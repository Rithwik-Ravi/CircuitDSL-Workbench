export const TOKEN_TYPES = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  SYMBOL: 'SYMBOL',
  EOF: 'EOF',
};

export class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];
  }

  tokenize() {
    this.tokens = [];
    this.errors = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (char === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
        continue;
      }

      if (/\s/.test(char)) {
        this.col++;
        this.pos++;
        continue;
      }

      // Single-line comments
      if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Keywords & Identifiers
      if (/[A-Za-z_]/.test(char)) {
        let value = '';
        const startCol = this.col;
        const startLine = this.line;
        while (
          this.pos < this.input.length &&
          /[A-Za-z0-9_]/.test(this.input[this.pos])
        ) {
          value += this.input[this.pos];
          this.pos++;
          this.col++;
        }

        const keywords = ['circuit', 'input', 'output', 'wire', 'Wire'];
        const type = keywords.includes(value)
          ? TOKEN_TYPES.KEYWORD
          : TOKEN_TYPES.IDENTIFIER;
        this.tokens.push({ type, value, line: startLine, col: startCol });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char)) {
        let value = '';
        const startCol = this.col;
        const startLine = this.line;
        while (
          this.pos < this.input.length &&
          /[0-9]/.test(this.input[this.pos])
        ) {
          value += this.input[this.pos];
          this.pos++;
          this.col++;
        }
        this.tokens.push({
          type: TOKEN_TYPES.NUMBER,
          value: parseInt(value, 10),
          line: startLine,
          col: startCol,
        });
        continue;
      }

      // Symbols
      if (['{', '}', '(', ')', '[', ']', ':', ';', '=', ','].includes(char)) {
        this.tokens.push({
          type: TOKEN_TYPES.SYMBOL,
          value: char,
          line: this.line,
          col: this.col,
        });
        this.pos++;
        this.col++;
        continue;
      }

      this.errors.push({
        type: 'error',
        line: this.line,
        col: this.col,
        message: `Lexical Error: Unexpected illegal character '${char}'`,
      });
      this.pos++;
      this.col++;
    }

    this.tokens.push({
      type: TOKEN_TYPES.EOF,
      value: null,
      line: this.line,
      col: this.col,
    });
    return { tokens: this.tokens, errors: this.errors };
  }
}
