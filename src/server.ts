import * as path from "path";
import * as fs from "fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { PROVIDERS, VALID_TIERS } from "./providers";
import { ensureState, writeState, nowIso } from "./state";
import type { AppState } from "./state";
import { buildEnvFromState } from "./env-builder";
import { listAliveProcesses } from "./processes";

function staticDir(): string {
  // In bundled mode, __dirname is dist/; static/ is a sibling.
  // When running from source, __dirname is src/; static/ is also a sibling.
  return path.resolve(__dirname, "..", "static");
}

function stateToResponse(state: AppState) {
  const provider = PROVIDERS[state.provider];
  const envPreview = buildEnvFromState(state);

  const preview: Record<string, string> = {};
  for (const [key, value] of Object.entries(envPreview)) {
    preview[key] =
      value && (key.includes("KEY") || key.includes("TOKEN"))
        ? "<set>"
        : value;
  }

  const fallbackModel = String(
    state.model || provider.defaultModel || ""
  );
  const modelOpus = String(state.model_opus || fallbackModel);
  const modelSonnet = String(state.model_sonnet || fallbackModel);
  const modelHaiku = String(state.model_haiku || fallbackModel);

  return {
    provider: state.provider,
    provider_name: provider.name,
    default_tier: state.default_tier || "sonnet",
    model: fallbackModel,
    model_opus: modelOpus,
    model_sonnet: modelSonnet,
    model_haiku: modelHaiku,
    base_url: state.base_url ?? null,
    has_auth_token: Boolean(state.auth_token),
    auth_env_var: provider.authEnvVar,
    updated_at: state.updated_at || nowIso(),
    env_preview: preview,
  };
}

function applyDefaults(
  providerId: string,
  model: string | null,
  modelOpus: string | null,
  modelSonnet: string | null,
  modelHaiku: string | null,
  baseUrl: string | null,
  currentState: AppState
): {
  model: string;
  modelOpus: string;
  modelSonnet: string;
  modelHaiku: string;
  baseUrl: string | null;
} {
  const provider = PROVIDERS[providerId];
  const fallback =
    (model || "").trim() ||
    String(currentState.model || "").trim() ||
    provider.defaultModel ||
    "";
  const resolvedModel = fallback;
  const resolvedOpus =
    (modelOpus || "").trim() ||
    String(currentState.model_opus || "").trim() ||
    fallback;
  const resolvedSonnet =
    (modelSonnet || "").trim() ||
    String(currentState.model_sonnet || "").trim() ||
    fallback;
  const resolvedHaiku =
    (modelHaiku || "").trim() ||
    String(currentState.model_haiku || "").trim() ||
    fallback;

  let resolvedBaseUrl = baseUrl;
  if (resolvedBaseUrl === null || resolvedBaseUrl === undefined) {
    resolvedBaseUrl = provider.baseUrl;
  }
  if (resolvedBaseUrl !== null && resolvedBaseUrl !== undefined) {
    resolvedBaseUrl = resolvedBaseUrl.trim() || null;
  }

  return {
    model: resolvedModel,
    modelOpus: resolvedOpus,
    modelSonnet: resolvedSonnet,
    modelHaiku: resolvedHaiku,
    baseUrl: resolvedBaseUrl,
  };
}

interface SwitchBody {
  provider: string;
  default_tier?: string | null;
  model?: string | null;
  model_opus?: string | null;
  model_sonnet?: string | null;
  model_haiku?: string | null;
  base_url?: string | null;
  auth_token?: string | null;
}

export async function startServer(
  host: string,
  port: number
): Promise<void> {
  const app = Fastify({ logger: false });

  await app.register(fastifyStatic, {
    root: staticDir(),
    prefix: "/static/",
  });

  // GET / → index.html
  app.get("/", async (_req, reply) => {
    const indexPath = path.join(staticDir(), "index.html");
    const stream = fs.createReadStream(indexPath);
    return reply.type("text/html; charset=utf-8").send(stream);
  });

  // GET /api/providers
  app.get("/api/providers", async () => {
    const items = Object.entries(PROVIDERS).map(([id, p]) => ({
      id,
      name: p.name,
      base_url: p.baseUrl,
      requires_auth: p.requiresAuth,
      auth_env_var: p.authEnvVar,
      default_model: p.defaultModel,
    }));
    return { providers: items };
  });

  // GET /api/state
  app.get("/api/state", async () => {
    const state = ensureState();
    return stateToResponse(state);
  });

  // POST /api/switch
  app.post<{ Body: SwitchBody }>("/api/switch", async (req, reply) => {
    const body = req.body;
    if (!body || !body.provider) {
      return reply.status(400).send({ detail: "provider is required" });
    }

    const providerId = body.provider.trim().toLowerCase();
    if (!(providerId in PROVIDERS)) {
      return reply
        .status(400)
        .send({ detail: `Unknown provider: ${providerId}` });
    }

    // Validate base_url
    if (
      body.base_url &&
      !body.base_url.startsWith("http://") &&
      !body.base_url.startsWith("https://")
    ) {
      return reply
        .status(400)
        .send({ detail: "base_url must start with http:// or https://" });
    }

    // Validate default_tier
    if (
      body.default_tier &&
      !(VALID_TIERS as readonly string[]).includes(body.default_tier)
    ) {
      return reply.status(400).send({
        detail: `default_tier must be one of ${VALID_TIERS.join(", ")}`,
      });
    }

    const current = ensureState();
    const defaults = applyDefaults(
      providerId,
      body.model ?? null,
      body.model_opus ?? null,
      body.model_sonnet ?? null,
      body.model_haiku ?? null,
      body.base_url ?? null,
      current
    );

    let token = (body.auth_token || "").trim();
    // If auth_token is not provided (null/undefined), keep existing token.
    if (body.auth_token === null || body.auth_token === undefined) {
      token = String(current.auth_token || "");
    }

    let defaultTier =
      (body.default_tier || "").trim() ||
      current.default_tier ||
      "sonnet";
    if (!(VALID_TIERS as readonly string[]).includes(defaultTier)) {
      defaultTier = "sonnet";
    }

    const state: AppState = {
      provider: providerId,
      default_tier: defaultTier,
      model: defaults.model,
      model_opus: defaults.modelOpus,
      model_sonnet: defaults.modelSonnet,
      model_haiku: defaults.modelHaiku,
      base_url: defaults.baseUrl,
      auth_token: token,
      updated_at: nowIso(),
    };

    writeState(state);
    return stateToResponse(state);
  });

  // GET /api/processes
  app.get("/api/processes", async () => {
    return { processes: listAliveProcesses() };
  });

  // GET /api/export-env
  app.get("/api/export-env", async () => {
    const state = ensureState();
    return buildEnvFromState(state);
  });

  await app.listen({ host, port });
  console.log(`Server running at http://${host}:${port}`);
}
