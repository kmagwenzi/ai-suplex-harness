#!/usr/bin/env node
"use strict";

/**
 * server.js — AI-Suplex MCP server (mcp v1).
 *
 * Transport: stdio, newline-delimited JSON-RPC 2.0.
 * Contract: AI-Suplex Kick-start/Spec — MCP Contract (mcp v1).md
 *
 * The server is a WINDOW: it reads the vault via resources and acts only through
 * the framework CLI (or the two declared file-writes). It owns no memory.
 *
 *   node Tools/mcp/server.js             # run the stdio server
 *   node Tools/mcp/server.js --contract  # print the frozen surface (contract test)
 */

const readline = require("readline");

// Loading the contract resolves the vault. When that fails, print the
// actionable message without a stack — a stack here names vault.js, not the
// real problem (the checkout is not linked yet).
let CONTRACT;
try {
  ({ CONTRACT } = require("./lib/vault"));
} catch (e) {
  if (e.code === "AISUPLEX_VAULT_UNLINKED" || e.code === "AISUPLEX_CONTRACT_INVALID") {
    process.stderr.write(e.message + "\n");
    process.exit(1);
  }
  throw e;
}

const resources = require("./resources");
const tools = require("./tools");
const prompts = require("./prompts");

// ── --contract: the executable surface, compared by Tools/test/contract.test.js ──
if (process.argv.includes("--contract")) {
  process.stdout.write(
    JSON.stringify(
      {
        contract: CONTRACT.contract,
        semver: CONTRACT.semver,
        tier: CONTRACT.tier,
        framework_min: CONTRACT.framework_min,
        capabilities: CONTRACT.capabilities,
        resources: CONTRACT.resources,
        tools: CONTRACT.tools,
        prompts: CONTRACT.prompts,
        writes: CONTRACT.writes,
        never: CONTRACT.never,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(0);
}

const SUPPLEX_CAP = {
  contract: CONTRACT.contract,
  semver: CONTRACT.semver,
  tier: CONTRACT.tier,
  framework: { name: "ai-suplex", version: CONTRACT.framework_min },
  capabilities: CONTRACT.capabilities,
};

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}
function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handle(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        return reply(id, {
          protocolVersion: (params && params.protocolVersion) || "2025-06-18",
          capabilities: { tools: {}, resources: {}, prompts: {}, suplex: SUPPLEX_CAP },
          serverInfo: { name: "ai-suplex-harness", version: "1.0.0" },
        });
      case "notifications/initialized":
      case "initialized":
        return; // notification — no response
      case "ping":
        return reply(id, {});
      case "tools/list":
        return reply(id, { tools: tools.list() });
      case "tools/call":
        return reply(id, tools.call(params && params.name, (params && params.arguments) || {}));
      case "resources/list":
        return reply(id, { resources: resources.list() });
      case "resources/templates/list":
        return reply(id, { resourceTemplates: resources.templates() });
      case "resources/read":
        return reply(id, { contents: [resources.read(params && params.uri)] });
      case "prompts/list":
        return reply(id, { prompts: prompts.list() });
      case "prompts/get":
        return reply(id, prompts.get(params && params.name, (params && params.arguments) || {}));
      default:
        if (isNotification) return;
        return error(id, -32601, "Method not found: " + method);
    }
  } catch (e) {
    if (isNotification) return;
    return error(id, -32603, e && e.message ? e.message : String(e));
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try {
    msg = JSON.parse(t);
  } catch {
    return; // ignore malformed lines
  }
  if (Array.isArray(msg)) msg.forEach(handle);
  else handle(msg);
});
rl.on("close", () => process.exit(0));
