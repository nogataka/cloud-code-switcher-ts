export interface ProviderDef {
  name: string;
  baseUrl: string | null;
  authEnvVar: string | null;
  requiresAuth: boolean;
  defaultModel: string;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  claude: {
    name: "Claude (Default)",
    baseUrl: null,
    authEnvVar: null,
    requiresAuth: false,
    defaultModel: "claude-opus-4-1",
  },
  azure: {
    name: "Azure Anthropic",
    baseUrl: "",
    authEnvVar: "ANTHROPIC_FOUNDRY_API_KEY",
    requiresAuth: true,
    defaultModel: "claude-opus-4-1",
  },
  glm: {
    name: "GLM (Zhipu AI)",
    baseUrl: "https://api.z.ai/api/anthropic",
    authEnvVar: "ANTHROPIC_AUTH_TOKEN",
    requiresAuth: true,
    defaultModel: "glm-4.7",
  },
  ollama: {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434",
    authEnvVar: null,
    requiresAuth: false,
    defaultModel: "qwen3-coder",
  },
  kimi: {
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.kimi.com/coding/",
    authEnvVar: "ANTHROPIC_API_KEY",
    requiresAuth: true,
    defaultModel: "kimi-k2.5",
  },
  custom: {
    name: "Custom Provider",
    baseUrl: "",
    authEnvVar: "ANTHROPIC_AUTH_TOKEN",
    requiresAuth: true,
    defaultModel: "",
  },
};

export const VALID_TIERS = ["opus", "sonnet", "haiku"] as const;
export type Tier = (typeof VALID_TIERS)[number];
