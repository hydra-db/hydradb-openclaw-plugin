# HydraDB OpenClaw Plugin

Persistent, cross-session memory for [OpenClaw](https://docs.openclaw.ai/plugins/manifest),
powered by [HydraDB](https://hydradb.com).

It recalls relevant context at prompt time, syncs your workspace docs into
HydraDB, and captures conversations as durable memory, over the same shared
engine (`scripts/plugin.mjs`) as the HydraDB Claude Code / Codex / Grok plugins.

## What's OpenClaw-specific here

- **Manifest:** `openclaw.plugin.json` at the repo root (plugin id, config schema,
  UI hints, and the shipped skill directories).
- **Runtime module:** `index.js`, declared via `package.json` `openclaw.extensions`.
  OpenClaw loads it and calls the default export with the plugin `api`; it
  registers typed `api.on` hooks (see below) over the shared engine.
- **Env prefix:** per the shared client contract, this client reads the canonical
  `HYDRADB_*` names plus the `HYDRA_OPENCLAW_*` prefix (see `CONTRACT.md`).
- **Skills:** the shared HydraDB skills under `skills/` for manual recall/ingest.

## Hooks

| OpenClaw typed hook | Engine action |
|---|---|
| `before_prompt_build` | recall relevant memory/knowledge and **prepend it to the prompt** (`prependContext`) |
| `after_tool_call` (file-writing tools) | incremental workspace sync |
| `agent_end` | capture the completed turn |
| `session_start` | sync workspace docs into HydraDB |

Prompt-time auto-recall (`before_prompt_build`) and workspace sync work out of the
box. **Turn capture (`agent_end`) reads conversation messages**, which OpenClaw
gates for non-bundled plugins: enable it with

```
plugins.entries.hydradb.hooks.allowConversationAccess: true
```

Everything else (`scripts/`, config, API docs, conformance vectors) is shared as-is.

## Prerequisites

- Node.js >= 18
- A HydraDB account: API key + database ([hydradb.com](https://hydradb.com))
- OpenClaw

## Install

Place this repo where OpenClaw loads plugins, or publish it and add it to your
OpenClaw config. Provide credentials either through OpenClaw's plugin config
(`api_key`, `database`, optional `collection`/`base_url`) or the environment:

```bash
export HYDRADB_API_KEY="your-api-key"
export HYDRADB_DATABASE="your-database"
# OpenClaw-prefixed names also work: HYDRA_OPENCLAW_API_KEY / HYDRA_OPENCLAW_TENANT_ID
```

## Install

```bash
openclaw plugins install /path/to/hydradb-openclaw --link   # or publish + install by name
```

Credentials come from OpenClaw plugin config (`api_key`, `database`, optional
`collection`/`base_url`) or the environment. The default search mode is `memory`;
set `HYDRADB_SEARCH_MODE=both` if you also want synced workspace knowledge to
auto-recall.

## Usage

- **Automatic recall** runs before each turn via `before_prompt_build` and
  prepends relevant memory/knowledge to the prompt.
- The shared skills provide manual `query` / `ingest` / `doctor` / `setup` /
  `last-recall` actions; the contract's canonical slash form is `/hydradb-query`,
  `/hydradb-ingest`, `/hydradb-list`, `/hydradb-inspect`, `/hydradb-delete`.

## Configuration

Config keys, environment overrides, and capture/search/ingest modes are identical
to the other HydraDB plugins - see `config.example.json` and `CONTRACT.md`.

## Verified

Tested against OpenClaw 2026.6.35: the plugin installs and loads, `before_prompt_build`
/ `after_tool_call` / `session_start` register cleanly, and a live `openclaw agent`
turn (Claude provider) answered from recalled HydraDB context resolved via the
`HYDRA_OPENCLAW_*` env prefix. Turn capture (`agent_end`) requires the
`hooks.allowConversationAccess` opt-in above.

## License

[Apache 2.0](LICENSE) - Copyright (c) 2026 HydraDB
