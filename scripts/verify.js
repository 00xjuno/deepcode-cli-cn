// 发布前验证脚本：确保 dist/cli.js 版本号、bin 路径、文件完整性均正确

import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ❌  ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅  ${msg}`);
}

console.log("=========================================");
console.log("  Deep Code CLI — Release Verification");
console.log("=========================================\n");

// 1. 验证 dist/cli.js 存在
const distCli = join(root, "dist", "cli.js");
if (!existsSync(distCli)) {
  fail("dist/cli.js not found. Run 'npm run bundle' first.");
} else {
  const bundle = readFileSync(distCli, "utf8");
  const bundleSize = Buffer.byteLength(bundle, "utf8");
  ok(`dist/cli.js found (${(bundleSize / 1024).toFixed(1)} KB)`);

  // 2. 检查 shebang
  if (!bundle.startsWith("#!/usr/bin/env node")) {
    fail("dist/cli.js missing shebang (#!/usr/bin/env node)");
  } else {
    ok("shebang correct");
  }

  // 3. 验证版本号一致性
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const expectedVersion = pkg.version;

  const versionMatch = bundle.match(/version\s*:\s*"([^"]+)"/);
  if (!versionMatch) {
    fail("Cannot find version string in dist/cli.js");
  } else if (versionMatch[1] !== expectedVersion) {
    fail(`Version mismatch: dist/cli.js has "${versionMatch[1]}", expected "${expectedVersion}"`);
  } else {
    ok(`version matches: ${expectedVersion}`);
  }

  // 4. 验证 deepcode-core-cn 引用
  if (!bundle.includes("deepcode-core-cn")) {
    fail("dist/cli.js does not reference deepcode-core-cn");
  } else {
    ok("deepcode-core-cn reference found");
  }

  // 5. 验证余额功能
  if (!bundle.includes("formatBalance")) {
    warn("formatBalance not found in bundle — balance feature may be missing");
  } else {
    ok("balance feature present");
  }

  // 6. 验证配置向导
  if (!bundle.includes("setupApiKey")) {
    warn("setupApiKey not found in bundle — setup wizard may be missing");
  } else {
    ok("setup wizard present");
  }
}

// 7. 验证 bin 字段
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!pkg.bin?.deepcode) {
  fail("package.json missing bin.deepcode");
} else if (!pkg.bin.deepcode.includes("dist/cli.js")) {
  fail(`bin.deepcode points to "${pkg.bin.deepcode}", expected dist/cli.js`);
} else {
  ok(`bin.deepcode: ${pkg.bin.deepcode}`);
}

// 8. 验证 files 字段
if (!pkg.files || !Array.isArray(pkg.files)) {
  fail("package.json missing files array");
} else if (!pkg.files.includes("dist/cli.js")) {
  fail("files array missing dist/cli.js");
} else if (!pkg.files.some((f) => f.includes("dist/bundled"))) {
  warn("files array missing dist/bundled/** pattern");
} else {
  ok("files array correct");
}

// 9. 验证 dependencies
const deps = pkg.dependencies || {};
if (!deps["deepcode-core-cn"]) {
  fail("dependencies missing deepcode-core-cn");
} else {
  ok(`deepcode-core-cn: ${deps["deepcode-core-cn"]}`);
}

// 10. npm pack 预览
console.log("\n--- npm pack --dry-run ---");
const pack = spawnSync("npm", ["pack", "--dry-run"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
const packOutput = pack.stdout + pack.stderr;
if (!packOutput.includes("dist/cli.js")) {
  fail("npm pack does not include dist/cli.js");
} else {
  ok("npm pack includes dist/cli.js");
}

// 总结
console.log("\n=========================================");
if (errors > 0) {
  console.error(`  ❌  ${errors} error(s), ${warnings} warning(s)`);
  console.error("  Verification FAILED. Fix the issues above before publishing.");
  console.log("=========================================\n");
  process.exit(1);
} else {
  console.log(`  ✅  All checks passed (${warnings} warning(s))`);
  console.log("  Ready to publish.");
  console.log("=========================================\n");
}
