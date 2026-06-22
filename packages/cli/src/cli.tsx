import * as readline from "node:readline";
import React from "react";
import { render } from "ink";
import { readSettings, writeSettings, setShellIfWindows, type DeepcodingSettings } from "@vegamo/deepcode-core";
import { checkForNpmUpdate, promptForPendingUpdate, type PackageInfo } from "./common/update-check";
import { AppContainer } from "./ui";

const args = process.argv.slice(2);
const packageInfo = readPackageInfo();

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${packageInfo.version || "unknown"}\n`);
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    [
      "deepcode - Deep Code CLI",
      "",
      "Usage:",
      "  deepcode                              Launch the interactive TUI in the current directory",
      "  deepcode -p <prompt>                  Launch with a pre-filled prompt",
      "  deepcode --prompt <prompt>            Same as -p",
      "  deepcode --version                    Print the version",
      "  deepcode --help                       Show this help",
      "",
      "Configuration:",
      "  First run will guide you through API key setup interactively.",
      "  ~/.deepcode/settings.json    User-level API key, model, base URL",
      "  ./.deepcode/settings.json    Project-level settings",
      "  ./.deepcode/skills/*/SKILL.md Project-level native skills",
      "  ./.agents/skills/*/SKILL.md   Project-level interoperable skills",
      "  ~/.deepcode/skills/*/SKILL.md User-level native skills",
      "  ~/.agents/skills/*/SKILL.md   User-level interoperable skills",
      "",
      "Inside the TUI:",
      "  enter            Send the prompt",
      "  shift+enter      Insert a newline",
      "  home/end         Move within the current line",
      "  alt+left/right   Move by word",
      "  ctrl+w           Delete the previous word",
      "  ctrl+v           Paste an image from the clipboard",
      "  ctrl+x           Clear pasted images",
      "  esc              Interrupt the current model turn",
      "  /                Open the skills/commands menu",
      "  /skills          List available skills",
      "  /model           Select model, thinking mode and effort control",
      "  /new             Start a fresh conversation",
      "  /init            Initialize an AGENTS.md file with instructions for LLM",
      "  /resume          Pick a previous conversation to continue",
      "  /continue        Continue the active conversation, or resume one if empty",
      "  /undo            Restore code and/or conversation to a previous point",
      "  /mcp             Show MCP server status and available tools",
      "  /raw             Toggle display mode for viewing or collapsing reasoning content",
      "  /exit            Quit",
      "  ctrl+d twice     Quit",
    ].join("\n") + "\n"
  );
  process.exit(0);
}

function extractInitialPrompt(args: string[]): string | undefined {
  const promptIndex = args.findIndex((arg) => arg === "-p" || arg === "--prompt");
  if (promptIndex !== -1 && promptIndex + 1 < args.length) {
    return args[promptIndex + 1];
  }
  return undefined;
}

let initialPrompt = extractInitialPrompt(args);
const projectRoot = process.cwd();
configureWindowsShell();

if (!process.stdin.isTTY) {
  process.stderr.write("deepcode requires an interactive terminal (TTY). " + "Re-run from a real terminal session.\n");
  process.exit(1);
}

void main();

// 首次运行时交互式配置 API Key
async function setupApiKey(): Promise<void> {
  const existingSettings = readSettings();
  const hasApiKey = !!existingSettings?.env?.API_KEY;
  if (hasApiKey) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        resolve(answer.trim());
      });
    });

  process.stdout.write("\n");
  process.stdout.write("  ╔══════════════════════════════════════════════╗\n");
  process.stdout.write("  ║       🐳 Deep Code CLI — 首次配置            ║\n");
  process.stdout.write("  ╠══════════════════════════════════════════════╣\n");
  process.stdout.write("  ║                                              ║\n");
  process.stdout.write("  ║  未检测到 API Key，请输入你的 DeepSeek 密钥    ║\n");
  process.stdout.write("  ║                                              ║\n");
  process.stdout.write("  ║  获取方式:                                    ║\n");
  process.stdout.write("  ║  https://platform.deepseek.com/api_keys       ║\n");
  process.stdout.write("  ║                                              ║\n");
  process.stdout.write("  ╚══════════════════════════════════════════════╝\n\n");

  let apiKey = "";
  while (!apiKey) {
    apiKey = await question("  API Key (sk-...): ");
    if (!apiKey) {
      process.stdout.write("  ⚠️  API Key 不能为空，请重新输入\n");
    }
  }

  // 合并已有设置
  const settings: DeepcodingSettings = {
    ...(existingSettings ?? {}),
    env: {
      ...(existingSettings?.env ?? {}),
      MODEL: existingSettings?.env?.MODEL || existingSettings?.model || "deepseek-v4-pro",
      BASE_URL: existingSettings?.env?.BASE_URL || "https://api.deepseek.com",
      API_KEY: apiKey,
    },
    thinkingEnabled: existingSettings?.thinkingEnabled ?? true,
    reasoningEffort: existingSettings?.reasoningEffort ?? "max",
  };

  writeSettings(settings);
  rl.close();

  process.stdout.write(`\n  ✅ 配置已保存到 ~/.deepcode/settings.json\n`);
  process.stdout.write(`  🚀 正在启动 Deep Code CLI...\n\n`);
}

async function main(): Promise<void> {
  await setupApiKey();

  const updatePromptResult = await promptForPendingUpdate(packageInfo);
  if (updatePromptResult.installed) {
    process.exit(0);
  }

  const restartRef: { current: (() => void) | null } = { current: null };

  function startApp(): void {
    let restarting = false;
    const appInitialPrompt = initialPrompt;
    initialPrompt = undefined;
    const inkInstance = render(
      <AppContainer
        projectRoot={projectRoot}
        version={packageInfo.version}
        initialPrompt={appInitialPrompt}
        onRestart={() => restartRef.current?.()}
      />,
      { exitOnCtrlC: false }
    );

    restartRef.current = () => {
      restarting = true;
      process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
      inkInstance.unmount();
      startApp();
    };

    inkInstance.waitUntilExit().then(() => {
      if (!restarting) {
        restartRef.current = null;
        process.exit(0);
      }
    });
  }

  void checkForNpmUpdate(packageInfo);

  startApp();
}

function configureWindowsShell(): void {
  process.env.NoDefaultCurrentDirectoryInExePath = "1";
  try {
    setShellIfWindows();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`deepcode: ${message}\n`);
    process.exit(1);
  }
}

function readPackageInfo(): PackageInfo {
  try {
    const pkg = require("../package.json") as { name?: unknown; version?: unknown };
    return {
      name: typeof pkg.name === "string" ? pkg.name : "deepcode-cli-cn",
      version: typeof pkg.version === "string" ? pkg.version : "",
    };
  } catch {
    return { name: "deepcode-cli-cn", version: "" };
  }
}
