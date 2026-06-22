import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const cliRoot = join(root, "packages", "cli");
const entry = join(cliRoot, "src", "cli.tsx");
const distDir = join(root, "dist");
const outfile = join(distDir, "cli.js");

// 所有 npm 包保持外部引用，包括 @vegamo/deepcode-core。
// deepcode-cli-cn 通过 npm 依赖 @010xjuno/deepcode-core 来获取运行时文件。
// esbuild alias 将源码中的 @vegamo/deepcode-core 重定向到 @010xjuno/deepcode-core。
await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  banner: { js: "#!/usr/bin/env node" },
  jsx: "automatic",
  jsxImportSource: "react",
  packages: "external",
  external: ["@vegamo/deepcode-core"],
  alias: {
    "@vegamo/deepcode-core": "deepcode-core-cn",
  },
  logOverride: {
    "empty-import-meta": "silent",
  },
});

console.log(`\n✅  ${outfile}  built successfully\n\n`);
