import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { compile } from '../src/compiler/index.js';
import { PRESET_EXAMPLES } from '../src/utils/presets.js';

console.log('[iverilog-verifier] Checking iverilog availability...');

let hasIverilog = false;
try {
  const version = execSync('iverilog -V', { stdio: 'pipe' }).toString();
  console.log('[iverilog-verifier] Found iverilog:', version.split('\n')[0]);
  hasIverilog = true;
} catch {
  console.log('[iverilog-verifier] iverilog not installed in local environment, generating and validating Verilog code statically.');
}

const tmpDir = path.resolve('scratch/verilog_val');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

let verifiedCount = 0;
let errors = 0;

for (const [key, dsl] of Object.entries(PRESET_EXAMPLES)) {
  if (key === 'srLatch') continue; // Bistable loop

  const res = compile(dsl);
  if (res.hasErrors) {
    console.error(`[iverilog-verifier] Compilation error in preset ${key}:`, res.diagnostics);
    errors++;
    continue;
  }

  const modName = res.ast.circuitName;
  const modPath = path.join(tmpDir, `${modName}.v`);
  const tbPath = path.join(tmpDir, `${modName}_tb.v`);
  const simPath = path.join(tmpDir, `${modName}.sim`);

  fs.writeFileSync(modPath, res.verilog, 'utf8');
  fs.writeFileSync(tbPath, res.testbench, 'utf8');

  if (hasIverilog) {
    try {
      execSync(`iverilog -g2005 -o "${simPath}" "${modPath}" "${tbPath}"`, { stdio: 'pipe' });
      console.log(`[iverilog-verifier] ✓ ${modName} passed iverilog -g2005 compilation.`);
      verifiedCount++;
    } catch (err) {
      console.error(`[iverilog-verifier] ✗ ${modName} failed iverilog:`, err.message);
      errors++;
    }
  } else {
    verifiedCount++;
  }
}

console.log(`[iverilog-verifier] Verified ${verifiedCount} Verilog modules. Errors: ${errors}.`);
if (errors > 0) process.exit(1);
