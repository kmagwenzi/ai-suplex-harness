"use strict";

/**
 * resources.js — the 8 read-only views of the vault (mcp v1).
 * Every resource either reads a canonical file or runs a READ-ONLY CLI.
 * A resource read never writes, syncs, or opens an instance.
 */

const fs = require("fs");
const path = require("path");
const { VAULT, read: readVault, within } = require("./lib/vault");
const cli = require("./lib/cli");

const RESOURCES = [
  { uri: "suplex://context", name: "Operator brief", description: "asmc open — threads, tasklists, staleness", mimeType: "application/json" },
  { uri: "suplex://mission", name: "Active Mission Context", description: "the live vault state", mimeType: "text/markdown" },
  { uri: "suplex://threads", name: "Open instances", description: "one row per context file", mimeType: "application/json" },
  { uri: "suplex://tasklists", name: "Open tasklists", description: "the open tasklists + progress", mimeType: "application/json" },
  { uri: "suplex://memory/index", name: "Memory index", description: "Memory/index.md", mimeType: "text/markdown" },
  { uri: "suplex://memory/lessons", name: "Lessons", description: "Memory/lessons.md", mimeType: "text/markdown" },
  { uri: "suplex://approvals", name: "Approval inbox", description: "the Hustler-decides inbox", mimeType: "application/json" },
];

const TEMPLATES = [
  { uriTemplate: "suplex://tasklist/{path}", name: "One tasklist", description: "a tasklist under Tasklists/", mimeType: "text/markdown" },
];

function list() {
  return RESOURCES;
}

function templates() {
  return TEMPLATES;
}

function readResource(uri) {
  switch (uri) {
    case "suplex://context": {
      const r = cli.run("asmc", ["open", "--json"]);
      return { uri, mimeType: "application/json", text: r.ok ? r.stdout : JSON.stringify({ error: r.stderr || "asmc open failed", status: r.status }) };
    }
    case "suplex://mission":
      return { uri, mimeType: "text/markdown", text: readVault("AI-Suplex Kick-start/Context Kick-start/Active Mission Context.md") || "" };
    case "suplex://threads": {
      const r = cli.run("3lm", ["threads", "--list", "--json"]);
      return { uri, mimeType: "application/json", text: r.ok ? r.stdout : "[]" };
    }
    case "suplex://tasklists": {
      const r = cli.run("asmc", ["status", "--json"]);
      return { uri, mimeType: "application/json", text: r.ok ? r.stdout : "{}" };
    }
    case "suplex://memory/index":
      return { uri, mimeType: "text/markdown", text: readVault("Memory/index.md") || "" };
    case "suplex://memory/lessons":
      return { uri, mimeType: "text/markdown", text: readVault("Memory/lessons.md") || "" };
    case "suplex://approvals": {
      const r = cli.run("approvals", ["--json"]);
      return { uri, mimeType: "application/json", text: r.ok ? r.stdout : JSON.stringify({ error: r.stderr || "approvals failed" }) };
    }
    default: {
      if (uri.startsWith("suplex://tasklist/")) {
        const rel = decodeURIComponent(uri.slice("suplex://tasklist/".length));
        const abs = path.resolve(VAULT, rel);
        if (!within("Tasklists", abs)) throw new Error("tasklist path escapes Tasklists/");
        const text = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
        if (text === null) throw new Error("tasklist not found: " + rel);
        return { uri, mimeType: "text/markdown", text };
      }
      throw new Error("unknown resource: " + uri);
    }
  }
}

module.exports = { list, templates, read: readResource, RESOURCES, TEMPLATES };
