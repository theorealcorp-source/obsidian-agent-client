# Changelog

All notable changes to this project will be documented in this file.

## [0.10.3] - 2026-04-07

### Fixed
- **Agent switcher ("..." menu) missing subscription agents** — `plugin.getAvailableAgents()` was missing `claudeSubscription`, `codexSubscription`, `ollama`. All 6 built-in agents now appear in the header switcher and Obsidian command palette.
- **Ollama "Command not configured" error** — Added `ollama` to `SUBSCRIPTION_AGENT_FALLBACKS`. When no explicit command is set, the adapter automatically resolves and runs `ollama-acp-server.cjs` from the plugin directory (`<vault>/.obsidian/plugins/agent-client/ollama-acp-server.cjs`). No manual path configuration required.

## [0.10.2] - 2026-04-07

### Fixed
- **Default agent keeps reverting to Claude API** — `collectAvailableAgentIds()` was missing `claudeSubscription`, `codexSubscription`, `ollama`. `ensureDefaultAgentId()` treated these as invalid IDs and always reset to `claude`. All 6 built-in agent IDs are now included.
- **"Command not configured" error for subscription agents** — Command validation in `acp.adapter.ts` threw immediately when `command` was empty. Subscription agents now fall back to `npx` automatically:
  - `claude-subscription` → `npx @agentclientprotocol/claude-agent-acp`
  - `codex-subscription` → `npx @zed-industries/codex-acp`

## [0.10.1] - 2026-04-07

### Changed
- **Subscription agent auth** — Removed pre-login API key requirement for `claude-subscription` and `codex-subscription`. Authentication is now handled automatically by the ACP protocol (browser OAuth on first connection).
- **Removed GitHub Copilot agent** — No standalone ACP adapter available; removed from built-in agents.

### Added
- **Ollama model dynamic picker** — Settings page now shows a dropdown of locally loaded models fetched from `/api/tags`. Added **Refresh** button to reload the list without restarting Obsidian.

## [0.10.0] - 2026-04-07

### Added
- **Claude (Subscription)** — Built-in agent for Claude via browser OAuth (`claude-subscription`).
- **Codex (ChatGPT Plus)** — Built-in agent for OpenAI Codex via browser OAuth (`codex-subscription`).
- **Ollama (Local LLM)** — Built-in agent for locally running Ollama models (`ollama`). Includes `ollama-acp-server.cjs` bridge script (Node.js, no external dependencies).
- **GitHub Copilot** — Built-in agent (later removed in 0.10.1).

## [0.9.4] - 2026-04-07

### Added
- Initial release published to `theorealcorp-source/obsidian-agent-client`.
