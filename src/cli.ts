import { Command } from "commander";
import { spawn } from "child_process";
import { ensureState } from "./state";
import { buildEnvFromState } from "./env-builder";
import { registerProcess, unregisterProcess } from "./processes";
import { startServer } from "./server";

const program = new Command();

program
  .name("cc-switch")
  .description("Cloud Code provider switcher")
  .version("1.0.0");

program
  .command("show")
  .description("Show current active provider state")
  .action(() => {
    const state = ensureState();
    console.log(`provider: ${state.provider}`);
    console.log(`default_tier: ${state.default_tier || "sonnet"}`);
    console.log(`model: ${state.model || "-"}`);
    console.log(`model_opus: ${state.model_opus || "-"}`);
    console.log(`model_sonnet: ${state.model_sonnet || "-"}`);
    console.log(`model_haiku: ${state.model_haiku || "-"}`);
    console.log(`base_url: ${state.base_url || "-"}`);
    console.log(`auth: ${state.auth_token ? "configured" : "missing"}`);
    console.log(`updated_at: ${state.updated_at}`);
  });

program
  .command("env")
  .description("Print shell export commands for active state")
  .action(() => {
    const state = ensureState();
    const env = buildEnvFromState(state);
    for (const [key, value] of Object.entries(env)) {
      if (!value) {
        console.log(`unset ${key}`);
      } else {
        const escaped = value.replace(/'/g, "'\"'\"'");
        console.log(`export ${key}='${escaped}'`);
      }
    }
  });

program
  .command("ui")
  .description("Start web UI and open browser")
  .action(async () => {
    const host = process.env.CC_SWITCH_HOST || "127.0.0.1";
    const port = parseInt(process.env.CC_SWITCH_PORT || "8787", 10);

    console.log(`Starting UI at http://${host}:${port}`);

    // Open browser after a delay
    setTimeout(async () => {
      try {
        const open = (await import("open")).default;
        await open(`http://${host}:${port}`);
      } catch {
        // Ignore if browser can't open
      }
    }, 1000);

    await startServer(host, port);
  });

program
  .command("run")
  .description("Run claude with active provider env")
  .allowUnknownOption(true)
  .helpOption(false)
  .argument("[args...]", "Arguments to pass to claude")
  .action((args: string[]) => {
    // Strip leading "--" if present
    if (args.length > 0 && args[0] === "--") {
      args = args.slice(1);
    }

    const state = ensureState();
    const envOverrides = buildEnvFromState(state);
    const env = { ...process.env, ...envOverrides };

    const proc = spawn("claude", args, {
      env,
      stdio: "inherit",
    });

    registerProcess(
      proc.pid!,
      process.cwd(),
      `claude ${args.join(" ")}`.trim(),
      state.provider || ""
    );

    proc.on("close", (code) => {
      unregisterProcess(proc.pid!);
      process.exit(code ?? 1);
    });

    proc.on("error", (err) => {
      console.error(`Failed to start: ${err.message}`);
      unregisterProcess(proc.pid!);
      process.exit(1);
    });
  });

program.parse();
