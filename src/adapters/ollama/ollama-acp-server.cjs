#!/usr/bin/env node
// Ollama ACP Server
// Implements the Agent Client Protocol (ACP) over stdin/stdout,
// bridging to Ollama's OpenAI-compatible chat API.
// Dependencies: none (Node.js built-in modules only)
'use strict';

const readline = require('readline');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROTOCOL_VERSION = 1;

// sessionId -> { messages: Array<{role, content}>, abortController: AbortController | null }
const sessions = new Map();

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function send(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
}

function respond(id, result) {
    send({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
    send({ jsonrpc: '2.0', id, error: { code, message } });
}

function notify(method, params) {
    send({ jsonrpc: '2.0', method, params });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateId() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 16);
}

/** Extract plain text from ACP ContentBlock[] or a plain string. */
function extractText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter((c) => c && c.type === 'text')
            .map((c) => c.text || '')
            .join('');
    }
    return String(content);
}

// ─── Ollama streaming call ─────────────────────────────────────────────────────

/**
 * Call Ollama's /api/chat endpoint with streaming enabled.
 * Emits agent_message_chunk session/update notifications as text arrives.
 * Returns the full accumulated response text.
 */
function streamOllama(sessionId, messages, abortController) {
    const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL || 'llama3.2';

    const url = new URL('/api/chat', baseUrl);
    const body = JSON.stringify({ model, messages, stream: true });
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
        let aborted = false;

        if (abortController) {
            abortController.signal.addEventListener('abort', () => {
                aborted = true;
                req.destroy();
                reject(new Error('cancelled'));
            });
        }

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + (url.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = lib.request(options, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                let errBody = '';
                res.on('data', (c) => { errBody += c; });
                res.on('end', () => {
                    reject(new Error(`Ollama error ${res.statusCode}: ${errBody.slice(0, 200)}`));
                });
                return;
            }

            let fullContent = '';
            let buffer = '';

            res.on('data', (chunk) => {
                if (aborted) return;
                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const data = JSON.parse(trimmed);
                        if (data.message && typeof data.message.content === 'string') {
                            const text = data.message.content;
                            if (text) {
                                fullContent += text;
                                notify('session/update', {
                                    sessionId,
                                    update: {
                                        sessionUpdate: 'agent_message_chunk',
                                        content: { type: 'text', text },
                                    },
                                });
                            }
                        }
                        if (data.done) {
                            // Ollama signals end of stream
                        }
                    } catch (_e) {
                        // ignore malformed JSON lines
                    }
                }
            });

            res.on('end', () => {
                if (!aborted) {
                    resolve(fullContent);
                }
            });

            res.on('error', (err) => {
                if (!aborted) reject(err);
            });
        });

        req.on('error', (err) => {
            if (!aborted) reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleRequest(request) {
    const { id, method, params } = request;

    switch (method) {
        case 'initialize': {
            respond(id, {
                protocolVersion: PROTOCOL_VERSION,
                agentCapabilities: { loadSession: false },
                serverInfo: { name: 'ollama-acp', version: '1.0.0' },
            });
            break;
        }

        case 'session/new': {
            const sessionId = generateId();
            sessions.set(sessionId, { messages: [], abortController: null });
            respond(id, { sessionId });
            break;
        }

        case 'session/prompt': {
            const session = sessions.get(params.sessionId);
            if (!session) {
                respondError(id, -32602, `Session not found: ${params.sessionId}`);
                break;
            }

            // Cancel any in-flight request for this session
            if (session.abortController) {
                session.abortController.abort();
            }
            session.abortController = { signal: { addEventListener: () => {}, removeEventListener: () => {} }, abort: () => {} };

            // Build a simple abort controller
            let cancelled = false;
            const abortListeners = [];
            session.abortController = {
                signal: {
                    get aborted() { return cancelled; },
                    addEventListener(_type, fn) { abortListeners.push(fn); },
                    removeEventListener(_type, fn) {
                        const idx = abortListeners.indexOf(fn);
                        if (idx !== -1) abortListeners.splice(idx, 1);
                    },
                },
                abort() {
                    cancelled = true;
                    abortListeners.forEach((fn) => fn());
                },
            };

            const userText = extractText(params.content);
            session.messages.push({ role: 'user', content: userText });

            try {
                const response = await streamOllama(
                    params.sessionId,
                    session.messages,
                    session.abortController,
                );
                session.messages.push({ role: 'assistant', content: response });
                session.abortController = null;
                respond(id, { stopReason: 'end_turn' });
            } catch (err) {
                session.abortController = null;
                if (err && err.message === 'cancelled') {
                    respond(id, { stopReason: 'cancelled' });
                } else {
                    // Send error as a message chunk so user can see it
                    const errorMsg = err ? `\n\n**Error:** ${err.message}` : '\n\n**Error:** Unknown error';
                    notify('session/update', {
                        sessionId: params.sessionId,
                        update: {
                            sessionUpdate: 'agent_message_chunk',
                            content: { type: 'text', text: errorMsg },
                        },
                    });
                    respond(id, { stopReason: 'end_turn' });
                }
            }
            break;
        }

        case 'session/cancel': {
            const session = sessions.get(params?.sessionId);
            if (session && session.abortController) {
                session.abortController.abort();
                session.abortController = null;
            }
            if (id !== undefined) {
                respond(id, {});
            }
            break;
        }

        default: {
            if (id !== undefined) {
                respondError(id, -32601, `Method not found: ${method}`);
            }
            break;
        }
    }
}

// ─── Stdin listener ───────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
        const request = JSON.parse(trimmed);
        await handleRequest(request);
    } catch (_e) {
        // ignore parse errors from malformed input
    }
});

rl.on('close', () => {
    process.exit(0);
});

// Keep the process alive
process.stdin.resume();
