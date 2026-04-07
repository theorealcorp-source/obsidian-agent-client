/**
 * Domain Models for Agent Configuration
 *
 * These types represent agent settings and configuration,
 * independent of the plugin infrastructure. They define
 * the core concepts of agent identity, capabilities, and
 * connection parameters.
 */

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment variable for agent process.
 *
 * Used to pass configuration and credentials to agent processes
 * via environment variables (e.g., API keys, paths, feature flags).
 */
export interface AgentEnvVar {
	/** Environment variable name (e.g., "ANTHROPIC_API_KEY") */
	key: string;

	/** Environment variable value */
	value: string;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Base configuration shared by all agent types.
 *
 * Defines the common properties needed to launch and communicate
 * with any ACP-compatible agent, regardless of the specific
 * implementation (Claude Code, Gemini CLI, custom agents, etc.).
 */
export interface BaseAgentSettings {
	/** Unique identifier for this agent (e.g., "claude", "gemini", "custom-1") */
	id: string;

	/** Human-readable display name shown in UI */
	displayName: string;

	/** Command to execute (full path to executable or command name) */
	command: string;

	/** Command-line arguments passed to the agent */
	args: string[];

	/** Environment variables for the agent process */
	env: AgentEnvVar[];
}

/**
 * Configuration for Gemini CLI agent.
 *
 * Extends base settings with Gemini-specific requirements.
 */
export interface GeminiAgentSettings extends BaseAgentSettings {
	/** Gemini API key (GEMINI_API_KEY) */
	apiKey: string;
}

/**
 * Configuration for Claude Code agent.
 *
 * Extends base settings with Claude-specific requirements.
 */
export interface ClaudeAgentSettings extends BaseAgentSettings {
	/** Anthropic API key for Claude (ANTHROPIC_API_KEY) */
	apiKey: string;
}

/**
 * Configuration for Codex CLI agent.
 *
 * Extends base settings with Codex-specific requirements.
 */
export interface CodexAgentSettings extends BaseAgentSettings {
	/** OpenAI API key for Codex (OPENAI_API_KEY) */
	apiKey: string;
}

/**
 * Configuration for Claude subscription (claude.ai) agent.
 *
 * Uses claude-agent-acp. Authentication is handled via ACP's authMethods
 * flow — the agent returns a "claude.ai subscription" auth option which
 * triggers browser-based OAuth.
 */
export interface ClaudeSubscriptionAgentSettings extends BaseAgentSettings {
	// No API key — ACP handles subscription auth via browser OAuth
}

/**
 * Configuration for Codex subscription (ChatGPT Plus) agent.
 *
 * Uses codex-acp. Authentication is handled via ACP's authMethods flow —
 * the agent returns a "ChatGPT subscription" auth option.
 */
export interface CodexSubscriptionAgentSettings extends BaseAgentSettings {
	// No API key — ACP handles subscription auth via browser OAuth
}

/**
 * Configuration for Ollama (local LLM) agent.
 *
 * Communicates with a locally running Ollama server via the bundled
 * ollama-acp-server.cjs bridge script.
 */
export interface OllamaAgentSettings extends BaseAgentSettings {
	/** Ollama base URL, default: http://localhost:11434 */
	baseUrl: string;
	/** Ollama model name, e.g. llama3.2, mistral, phi3 */
	model: string;
}

/**
 * Configuration for custom ACP-compatible agents.
 *
 * Uses only the base settings, allowing users to configure
 * any agent that implements the Agent Client Protocol.
 */
export type CustomAgentSettings = BaseAgentSettings;
