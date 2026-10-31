import { describe, test, expect } from 'vitest';
import { compile } from '../compiler/index.js';
import { PRESET_EXAMPLES } from '../utils/presets.js';

describe('Golden Tests for Every Example (V4)', () => {
  const examplesToTest = Object.entries(PRESET_EXAMPLES).filter(
    ([key]) => key !== 'srLatch' // srLatch has cross-coupled combinational feedback which correctly triggers E_COMBINATIONAL_LOOP
  );

  for (const [key, code] of examplesToTest) {
    test(`Golden example: ${key} compiles, verifies equivalent, and produces valid Verilog`, () => {
      const res = compile(code);

      // Must have zero compiler errors
      const errors = res.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toHaveLength(0);

      // Must construct AST, IR, and optimized IR
      expect(res.ast).toBeDefined();
      expect(res.rawIR.length).toBeGreaterThan(0);
      expect(res.optimizedIR.length).toBeGreaterThan(0);

      // Must prove equivalence between raw and optimized IR
      if (res.equivalence) {
        expect(res.equivalence.equivalent).toBe(true);
      }

      // Must produce valid Verilog module
      expect(res.verilog).toContain(`module ${res.ast.circuitName}`);
      expect(res.verilog).toContain('endmodule');
      expect(res.verilog).not.toContain('~&');
      expect(res.verilog).not.toContain('~|');

      // Must produce self-checking testbench
      expect(res.testbench).toContain(`module ${res.ast.circuitName}_tb`);
      expect(res.testbench).toContain('$finish');
    });
  }

  test('OptimizationDemo golden reduction check: 5 gates -> 2 gates (60%)', () => {
    const res = compile(PRESET_EXAMPLES.optimizationTest);
    expect(res.stats.initialGateCount).toBe(5);
    expect(res.stats.optimizedGateCount).toBe(2);
    expect(res.stats.reductionPct).toBe(60);
    expect(res.equivalence.equivalent).toBe(true);
  });
});
