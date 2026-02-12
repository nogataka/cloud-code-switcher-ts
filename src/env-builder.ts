import { PROVIDERS } from "./providers";
import type { AppState } from "./state";

export function buildEnvFromState(state: AppState): Record<string, string> {
  const providerId = state.provider;
  const provider = PROVIDERS[providerId];
  const env: Record<string, string> = {};

  if (providerId === "claude") {
    return env;
  }

  // Shared conflict prevention: clear unrelated auth/mode envs first.
  env["CLAUDE_CODE_USE_VERTEX"] = "";
  env["CLOUD_ML_REGION"] = "";
  env["ANTHROPIC_VERTEX_PROJECT_ID"] = "";
  env["CLAUDE_CODE_USE_FOUNDRY"] = "";
  env["ANTHROPIC_BASE_URL"] = "";
  env["ANTHROPIC_API_KEY"] = "";
  env["ANTHROPIC_AUTH_TOKEN"] = "";
  env["ANTHROPIC_FOUNDRY_BASE_URL"] = "";
  env["ANTHROPIC_FOUNDRY_RESOURCE"] = "";
  env["ANTHROPIC_FOUNDRY_API_KEY"] = "";

  // Azure uses Microsoft Foundry mode per official Claude Code docs.
  if (providerId === "azure") {
    env["CLAUDE_CODE_USE_FOUNDRY"] = "1";
    if (state.base_url) {
      env["ANTHROPIC_FOUNDRY_BASE_URL"] = String(state.base_url);
    }
    const token = String(state.auth_token || "");
    if (token) {
      env["ANTHROPIC_FOUNDRY_API_KEY"] = token;
    }
  } else {
    // Non-Foundry providers use Anthropic-compatible endpoint env.
    if (state.base_url) {
      env["ANTHROPIC_BASE_URL"] = String(state.base_url);
    }
    const token = String(state.auth_token || "");
    if (token && provider.authEnvVar) {
      env[provider.authEnvVar] = token;
    }
  }

  const fallbackModel = String(
    state.model || provider.defaultModel || ""
  );
  const modelOpus = String(state.model_opus || fallbackModel);
  const modelSonnet = String(state.model_sonnet || fallbackModel);
  const modelHaiku = String(state.model_haiku || fallbackModel);

  if (modelOpus) env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = modelOpus;
  if (modelSonnet) env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = modelSonnet;
  if (modelHaiku) env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = modelHaiku;

  // Set CLAUDE_MODEL based on the selected default tier.
  const defaultTier = state.default_tier || "sonnet";
  const tierModelMap: Record<string, string> = {
    opus: modelOpus,
    sonnet: modelSonnet,
    haiku: modelHaiku,
  };
  const claudeModel = tierModelMap[defaultTier] || modelSonnet;
  if (claudeModel) {
    env["CLAUDE_MODEL"] = claudeModel;
  }

  return env;
}
