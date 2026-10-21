"use strict";

/**
 * prompts.js — the 7 commands as MCP prompts (mcp v1).
 * The prompt returns the pattern text; the UI renders it. One source of truth:
 * Prompt Patterns/ (Spec — MCP Contract §4).
 */

const fs = require("fs");
const path = require("path");
const { VAULT } = require("./lib/vault");

const PROMPTS = [
  { name: "session-start", description: "Generate a Session Start prompt from a tasklist", arguments: [{ name: "taskId", required: false }] },
  { name: "session-end-report", description: "Generate the Session End Report", arguments: [{ name: "session", required: false }] },
  { name: "artifact-capture", description: "Capture an artifact", arguments: [{ name: "source", required: false }] },
  { name: "save-context", description: "Save the instance context", arguments: [{ name: "thread", required: false }, { name: "instance", required: false }] },
  { name: "tasklist-generation", description: "Turn raw to-dos into a tasklist", arguments: [{ name: "source", required: false }] },
  { name: "weekly-review", description: "Run the weekly review", arguments: [{ name: "week", required: false }] },
  { name: "b-bomb-promotion", description: "Promote an artifact to a B-Bomb", arguments: [{ name: "artifact", required: false }] },
];

const FILES = {
  "session-start": "Prompt Patterns/📄 Pattern - Session Start Prompt Generation.md",
  "session-end-report": "Prompt Patterns/📄 Pattern - Session End Report.md",
  "artifact-capture": "Prompt Patterns/📄 Pattern - Artifact Capture.md",
  "save-context": "Prompt Patterns/📄 Pattern - Save Context.md",
  "tasklist-generation": "Prompt Patterns/📄 Pattern - Tasklist Generation.md",
  "weekly-review": "Prompt Patterns/📄 Pattern - Weekly Review Generation.md",
  "b-bomb-promotion": "Prompt Patterns/📄 Pattern - B-Bomb Promotion.md",
};

function list() {
  return PROMPTS;
}

function get(name, args) {
  const rel = FILES[name];
  if (!rel) throw new Error("unknown prompt: " + name);
  const abs = path.join(VAULT, rel);
  const body = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "(pattern file not found: " + rel + ")";
  const argLine = Object.entries(args || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const meta = PROMPTS.find((p) => p.name === name);
  return {
    description: meta ? meta.description : name,
    messages: [
      {
        role: "user",
        content: { type: "text", text: argLine ? `ARGS\n${argLine}\n\n---\n\n${body}` : body },
      },
    ],
  };
}

module.exports = { list, get, PROMPTS, FILES };
