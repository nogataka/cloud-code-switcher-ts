/* ── DOM refs ── */
const providerSelect = document.getElementById("provider");
const defaultTierSelect = document.getElementById("default-tier");
const modelOpusInput = document.getElementById("model-opus");
const modelSonnetInput = document.getElementById("model-sonnet");
const modelHaikuInput = document.getElementById("model-haiku");
const baseUrlInput = document.getElementById("base-url");
const authTokenInput = document.getElementById("auth-token");
const notification = document.getElementById("notification");
const form = document.getElementById("switch-form");

const currentProvider = document.getElementById("current-provider");
const currentDefaultTier = document.getElementById("current-default-tier");
const currentOpus = document.getElementById("current-opus");
const currentSonnet = document.getElementById("current-sonnet");
const currentHaiku = document.getElementById("current-haiku");
const currentUrl = document.getElementById("current-url");
const currentAuth = document.getElementById("current-auth");
const currentUpdated = document.getElementById("current-updated");
const statusBadge = document.getElementById("status-badge");
const envPreview = document.getElementById("env-preview");
const processList = document.getElementById("process-list");
const refreshBtn = document.getElementById("refresh-processes");

let providerDefs = [];
let notifyTimer = null;

/* ── Helpers ── */

const TIER_LABELS = { opus: "Opus", sonnet: "Sonnet", haiku: "Haiku" };
function tierLabel(tier) {
  return TIER_LABELS[tier] || tier;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function showNotification(text, isError = false) {
  if (notifyTimer) clearTimeout(notifyTimer);
  notification.textContent = text;
  notification.className = `notification ${isError ? "error" : "success"}`;
  notification.hidden = false;
  notifyTimer = setTimeout(() => {
    notification.hidden = true;
  }, 5000);
}

function relativeTime(isoStr) {
  if (!isoStr) return "-";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── State display ── */

function fillCurrent(state) {
  currentProvider.textContent = state.provider_name;
  statusBadge.textContent = state.provider;
  currentDefaultTier.textContent = tierLabel(state.default_tier);
  currentOpus.textContent = state.model_opus || "-";
  currentSonnet.textContent = state.model_sonnet || "-";
  currentHaiku.textContent = state.model_haiku || "-";
  currentUrl.textContent = state.base_url || "-";
  currentAuth.textContent = state.has_auth_token ? "Configured" : "Not set";
  currentUpdated.textContent = state.updated_at
    ? new Date(state.updated_at).toLocaleString("ja-JP")
    : "-";
  envPreview.textContent = JSON.stringify(state.env_preview, null, 2);

  providerSelect.value = state.provider;
  defaultTierSelect.value = state.default_tier || "sonnet";
  modelOpusInput.value = state.model_opus || state.model || "";
  modelSonnetInput.value = state.model_sonnet || state.model || "";
  modelHaikuInput.value = state.model_haiku || state.model || "";
  baseUrlInput.value = state.base_url || "";
}

/* ── Provider select ── */

function renderProviderOptions(providers) {
  providerSelect.innerHTML = "";
  for (const p of providers) {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    providerSelect.appendChild(option);
  }
}

function applyProviderHints() {
  const selected = providerDefs.find((p) => p.id === providerSelect.value);
  if (!selected) return;
  if (!modelOpusInput.value && selected.default_model)
    modelOpusInput.value = selected.default_model;
  if (!modelSonnetInput.value && selected.default_model)
    modelSonnetInput.value = selected.default_model;
  if (!modelHaikuInput.value && selected.default_model)
    modelHaikuInput.value = selected.default_model;
  if (!baseUrlInput.value && selected.base_url)
    baseUrlInput.value = selected.base_url;
}

providerSelect.addEventListener("change", applyProviderHints);

/* ── Process list ── */

function renderProcesses(processes) {
  if (!processes.length) {
    processList.innerHTML = '<p class="empty-state">No running processes</p>';
    return;
  }
  processList.innerHTML = processes
    .map(
      (p) => `
    <div class="process-entry">
      <div class="proc-header">
        <span class="proc-pid">PID ${p.pid}</span>
        <span class="proc-provider">${p.provider || "-"}</span>
      </div>
      <div class="proc-command">${escapeHtml(p.command || "-")}</div>
      <div class="proc-meta">${escapeHtml(p.cwd || "")} &middot; started ${relativeTime(p.started_at)}</div>
    </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function refreshProcesses() {
  try {
    const data = await fetchJson("/api/processes");
    renderProcesses(data.processes || []);
  } catch {
    processList.innerHTML = '<p class="empty-state">Failed to load</p>';
  }
}

refreshBtn.addEventListener("click", refreshProcesses);

// Auto-refresh processes every 10 seconds
setInterval(refreshProcesses, 10000);

/* ── Form submit ── */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  notification.hidden = true;
  try {
    const payload = {
      provider: providerSelect.value,
      default_tier: defaultTierSelect.value,
      model: modelOpusInput.value.trim() || null,
      model_opus: modelOpusInput.value.trim() || null,
      model_sonnet: modelSonnetInput.value.trim() || null,
      model_haiku: modelHaikuInput.value.trim() || null,
      base_url: baseUrlInput.value.trim() || null,
      auth_token: authTokenInput.value.trim() || null,
    };
    const state = await fetchJson("/api/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    fillCurrent(state);
    authTokenInput.value = "";
    showNotification(
      `${state.provider_name} / ${tierLabel(state.default_tier)} に切り替えました`
    );
  } catch (err) {
    showNotification(`保存に失敗: ${err.message}`, true);
  }
});

/* ── Boot ── */

async function boot() {
  try {
    const [providersRes, state] = await Promise.all([
      fetchJson("/api/providers"),
      fetchJson("/api/state"),
    ]);
    providerDefs = providersRes.providers || [];
    renderProviderOptions(providerDefs);
    fillCurrent(state);
    refreshProcesses();
  } catch (err) {
    showNotification(`初期化エラー: ${err.message}`, true);
  }
}

boot();
