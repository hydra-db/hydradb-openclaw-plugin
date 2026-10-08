---
name: query
description: Query HydraDB in the configured search mode. Use to inspect what HydraDB knows: memories, workspace knowledge, or both.
disable-model-invocation: true
allowed-tools: Bash(node *)
argument-hint: "<query>"
---

Run bounded retrieval for the provided query:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin.mjs" query --json "$ARGUMENTS"
```

Summarize the strongest matches from whichever backends are active in the configured `searchMode`. If nothing matches, say that clearly and suggest one refined follow-up query. Never print raw secret values even if retrieved content contains them.

