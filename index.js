import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const RUNNER = path.join(ROOT, "scripts", "run-plugin.sh")

function engineEnv(config = {}) {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT }
  const set = (key, value) => {
    if (value != null && value !== "" && (env[key] == null || env[key] === "")) env[key] = String(value)
  }
  set("HYDRADB_API_KEY", config.api_key)
  set("HYDRADB_DATABASE", config.database)
  set("HYDRADB_COLLECTION", config.collection)
  set("HYDRADB_BASE_URL", config.base_url)
  return env
}

function runEngine(subcommand, stdin, config) {
  const res = spawnSync("bash", [RUNNER, subcommand], {
    input: stdin ?? "",
    encoding: "utf8",
    timeout: 30000,
    env: engineEnv(config),
  })
  return res.stdout ?? ""
}

function parseContext(out) {
  for (const line of String(out).trim().split("\n")) {
    try {
      const parsed = JSON.parse(line)
      const ctx = parsed?.hookSpecificOutput?.additionalContext ?? parsed?.additional_context
      if (ctx) return ctx
    } catch {
      continue
    }
  }
  return ""
}

/** Find the last assistant-authored message object in a message list. */
function lastAssistantMessage(messages = []) {
  if (!Array.isArray(messages)) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if ((m?.role ?? m?.source?.kind) === "assistant") return m
  }
  return null
}

/**
 * OpenClaw plugin entry: registers typed hooks over the shared HydraDB engine.
 *
 * - before_prompt_build: recall relevant memory and prepend it to the prompt.
 * - after_tool_call: incremental workspace sync after file-writing tools.
 * - agent_end: capture the completed turn.
 * - session_start: sync workspace docs into HydraDB.
 *
 * Credentials resolve from plugin config or the HYDRADB_* / HYDRA_OPENCLAW_* env.
 */
export default function hydradb(api) {
  const config = (api && (api.config || (typeof api.getConfig === "function" && api.getConfig()))) || {}

  api.on("before_prompt_build", async (event, ctx) => {
    const prompt = event?.prompt ?? ""
    if (!prompt) return undefined
    const sessionId = ctx?.sessionId ?? ctx?.runId ?? "openclaw"
    const recalled = parseContext(
      runEngine("user-prompt-submit", JSON.stringify({ session_id: sessionId, prompt }), config)
    )
    return recalled ? { prependContext: recalled } : undefined
  })

  api.on("after_tool_call", async (event) => {
    const toolName = String(event?.toolName ?? "")
    if (!/write|edit|create|save|apply/i.test(toolName)) return
    const params = event?.params ?? {}
    const file = params.file_path ?? params.path ?? params.file
    runEngine("post-tool-use", JSON.stringify({ tool_input: { file_path: file } }), config)
  })

  api.on("agent_end", async (event, ctx) => {
    // Resolve the session id the same way as before_prompt_build (sessionId
    // first, then runId) so the save reads the session that holds the pending
    // prompt, and pass the assistant reply so the completed turn is captured.
    const sessionId = ctx?.sessionId ?? event?.sessionId ?? ctx?.runId ?? event?.runId ?? "openclaw"
    const assistant =
      event?.response ?? event?.message ?? event?.output ?? event?.result ?? lastAssistantMessage(event?.messages)
    runEngine("stop", JSON.stringify({ session_id: sessionId, last_assistant_message: assistant }), config)
  })

  api.on("session_start", async () => {
    runEngine("session-sync-hook", "{}", config)
  })
}
