"use strict";

/**
 * prompts.js — the 7 commands as MCP prompts (mcp v1).
 *
 * Each prompt surfaces the friendly one-liner (`AI-Suplex: <Command>`) and reads its
 * source of truth — a `⚡ Command — <Name>.md` doc where one exists, else the Pattern.
 * One source of truth: Prompt Patterns/ (Spec — MCP Contract §4).
 */

const fs = require("fs");
const path = require("path");
const { VAULT } = require("./lib/vault");

const PROMPTS = [
  {
    name: "session-start",
    command: "AI-Suplex: Session Start",
    description: "Generate a Session Start prompt from a tasklist",
    file: "Prompt Patterns/📄 Pattern - Session Start Prompt Generation.md",
    arguments: [{ name: "taskId", required: false }],
  },
  {
    name: "session-end-report",
    command: "AI-Suplex: Session End Report",
    description: "Generate the Session End Report (with the memory loop)",
    file: "Prompt Patterns/AI-Suplex Commands/⚡ Command — Session End Report.md",
    arguments: [{ name: "session", required: false }],
  },
  {
    name: "artifact-capture",
    command: "AI-Suplex: Artifact Capture",
    description: "Capture an artifact from chat, a file, or raw content",
    file: "Prompt Patterns/📄 Pattern - Artifact Capture.md",
    arguments: [{ name: "source", required: false }],
  },
  {
    name: "save-context",
    command: "AI-Suplex: Save Context",
    description: "Persist the thread's context to its instance file",
    file: "Prompt Patterns/AI-Suplex Commands/⚡ Command — Save Context.md",
    arguments: [{ name: "thread", required: false }, { name: "instance", required: false }],
  },
  {
    name: "tasklist-generation",
    command: "AI-Suplex: Tasklist Generation",
    description: "Turn raw to-dos into a structured tasklist",
    file: "Prompt Patterns/AI-Suplex Commands/⚡ Command — Tasklist Generation.md",
    arguments: [{ name: "source", required: false }],
  },
  {
    name: "weekly-review",
    command: "AI-Suplex: Weekly Review",
    description: "Run the weekly review with metrics",
    file: "Prompt Patterns/📄 Pattern - Weekly Review Generation.md",
    arguments: [{ name: "week", required: false }],
  },
  {
    name: "b-bomb-promotion",
    command: "AI-Suplex: B-Bomb Promotion",
    description: "Promote an artifact to a B-Bomb",
    file: "Prompt Patterns/📄 Pattern - B-Bomb Promotion.md",
    arguments: [{ name: "artifact", required: false }],
  },
];

function list() {
  return PROMPTS.map((p) => ({
    name: p.name,
    command: p.command,
    description: p.description,
    arguments: p.arguments,
  }));
}

function get(name, args) {
  const meta = PROMPTS.find((p) => p.name === name);
  if (!meta) throw new Error("unknown prompt: " + name);
  const abs = path.join(VAULT, meta.file);
  const body = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "(file not found: " + meta.file + ")";
  const argLine = Object.entries(args || {})
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");
  const text =
    `# ⚡ ${meta.command}\n\n` +
    `CONTENT\n  - <Source type>: <value>\n` +
    (argLine ? `${argLine}\n` : "") +
    `\nADDITIONAL: <instructions>\n\n` +
    `---\n\n` +
    body;
  return {
    description: meta.description,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

module.exports = { list, get, PROMPTS };
