import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PROVIDERS, VALID_TIERS } from "./providers";
import { atomicWriteFileSync } from "./fs-utils";

export const STATE_DIR = path.join(
  os.homedir(),
  ".config",
  "cloud-code-switcher"
);
export const STATE_PATH = path.join(STATE_DIR, "state.json");

export interface AppState {
  provider: string;
  default_tier: string;
  model: string;
  model_opus: string;
  model_sonnet: string;
  model_haiku: string;
  base_url: string | null;
  auth_token: string;
  updated_at: string;
  [key: string]: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function defaultState(): AppState {
  const dm = PROVIDERS["claude"].defaultModel;
  return {
    provider: "claude",
    default_tier: "sonnet",
    model: dm,
    model_opus: dm,
    model_sonnet: dm,
    model_haiku: dm,
    base_url: null,
    auth_token: "",
    updated_at: nowIso(),
  };
}

export function writeState(state: AppState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  atomicWriteFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function ensureState(): AppState {
  fs.mkdirSync(STATE_DIR, { recursive: true });

  if (!fs.existsSync(STATE_PATH)) {
    const state = defaultState();
    writeState(state);
    return state;
  }

  let data: AppState;
  try {
    data = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    data = defaultState();
    writeState(data);
    return data;
  }

  if (!data.provider || !(data.provider in PROVIDERS)) {
    data = defaultState();
    writeState(data);
  } else {
    // Migrate older state files that had a single "model" field.
    const fallbackModel = String(
      data.model || PROVIDERS[data.provider].defaultModel || ""
    );
    if (!data.model_opus) data.model_opus = fallbackModel;
    if (!data.model_sonnet) data.model_sonnet = fallbackModel;
    if (!data.model_haiku) data.model_haiku = fallbackModel;
    if (data.model !== fallbackModel) data.model = fallbackModel;

    // Migrate: add default_tier if missing.
    if (
      !data.default_tier ||
      !(VALID_TIERS as readonly string[]).includes(data.default_tier)
    ) {
      data.default_tier = "sonnet";
    }
    writeState(data);
  }
  return data;
}

export { nowIso };
