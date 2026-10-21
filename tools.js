"use strict";

/**
 * tools.js — the 9 action tools (mcp v1).
 *
 * Every tool is ONE framework CLI invocation (cli.run) or a DECLARED file-write
 * (suplex_capture · suplex_save_context). No logic lives here that the framework
 * already owns (Spec — MCP Contract §3, §8).
 */

const fs = require("fs");
const path = require("path");
const { VAULT, read: readVault, detectCycleWeek, within } = require("./lib/vault");
const cli = require("./lib/cli");
// paths.js is framework-owned: load it from the vault (works co-located AND extracted).
const P = require(path.join(VAULT, "Tools", "paths.js"));

const TOOLS = [
  {
    name: "suplex_status",
    description: "The vault state — asmc status (threads · tasklists · staleness)",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "suplex_tasklist_next",
    description: "The next open task across the active/parked tasklists",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "suplex_capture",
    description: "Write one artifact, insight, or note",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["artifact", "insight", "note"] },
        focus: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        source: { type: "string" },
      },
      required: ["type", "focus", "title", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "suplex_save_context",
    description: "Append a brief to one instance context file",
    inputSchema: {
      type: "object",
      properties: {
        thread: { type: "string" },
        instance: { type: "string" },
        body: { type: "string" },
      },
      required: ["body"],
      additionalProperties: false,
    },
  },
  {
    name: "suplex_close",
    description: "Close the operator loop — 3lm learn -> index (3lm end only when a Session End report exists)",
    inputSchema: {
      type: "object",
      properties: { dryRun: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "suplex_index",
    description: "Refresh Memory/index.md",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "suplex_promote",
    description: "Score and promote lessons (Hustler-gated: approved must be true)",
    inputSchema: {
      type: "object",
      properties: { min: { type: "number" }, approved: { type: "boolean" } },
      required: ["approved"],
      additionalProperties: false,
    },
  },
  {
    name: "suplex_approve",
    description: "Record a Hustler decision and execute the one sanctioned action",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string" },
        decision: { type: "string", enum: ["approve", "reject"] },
        note: { type: "string" },
      },
      required: ["item", "decision"],
      additionalProperties: false,
    },
  },
  {
    name: "suplex_ritual",
    description: "Run or plan the weekly ritual (Hustler-gated: approved must be true)",
    inputSchema: {
      type: "object",
      properties: {
        which: { type: "string", enum: ["saturday", "tuesday"] },
        run: { type: "boolean" },
        tier: { type: "string", enum: ["auto", "free", "ultra"] },
        approved: { type: "boolean" },
      },
      required: ["which", "approved"],
      additionalProperties: false,
    },
  },
];

function list() {
  return TOOLS;
}

function text(s) {
  return { content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 2) }] };
}

function pad(n) {
  return String(n).padStart(2, "0");
}
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
function yamlStr(s) {
  return JSON.stringify(String(s));
}

// ── declared file-writes ──────────────────────────────────────────────────
function capture(args) {
  const { cycle, week } = detectCycleWeek();
  if (!cycle || !week) {
    throw new Error(
      "could not detect the current cycle/week from Memory/vault-context.md — run `node Tools/vault-index.js --current` first",
    );
  }

  if (args.type === "insight") {
    const rel = P.insightDir(cycle, week);
    const abs = path.join(VAULT, rel);
    if (!within("Insights", abs)) throw new Error("capture path escapes Insights/");
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const now = new Date();
    const line = `- ${now.toISOString().slice(0, 16).replace("T", " ")} – *${args.focus}* – ${args.content}\n`;
    fs.appendFileSync(abs, line);
    return text({ ok: true, kind: "insight", path: rel });
  }

  const rel = `${P.artifactDir(cycle, week)}/${stamp()}-${slug(args.title)}-${slug(args.focus)}.md`;
  const abs = path.join(VAULT, rel);
  if (!within("Artifacts", abs)) throw new Error("capture path escapes Artifacts/");
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const body = [
    "---",
    `type: ${args.type === "note" ? "note" : "artifact"}`,
    `title: ${yamlStr(args.title)}`,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    `cycle: ${cycle}`,
    `week: ${week}`,
    `focus: ${slug(args.focus)}`,
    ...(args.source ? [`source: ${yamlStr(args.source)}`] : []),
    "tags: []",
    "---",
    "",
    `# ${args.title}`,
    "",
    args.content,
    "",
  ].join("\n");
  fs.writeFileSync(abs, body);
  return text({ ok: true, kind: args.type, path: rel });
}

function saveContext(args) {
  if (!args.body) throw new Error("body is required");
  const active = path.join(VAULT, "AI-Suplex Kick-start", "Context Kick-start", "Active");
  const tried = [];
  let file = null;

  if (args.instance) {
    const stem = args.instance.replace(/\.md$/, "");
    const candidates = [path.join(active, stem + ".md")];
    if (args.thread) candidates.push(path.join(active, `${args.thread}-${stem}.md`));
    for (const c of candidates) {
      tried.push(path.basename(c));
      if (fs.existsSync(c)) {
        file = c;
        break;
      }
    }
  }
  if (!file) {
    throw new Error(
      "instance context file not found (pass instance = the filename stem, e.g. project-tasks-4-777-production-harness). Tried: " +
        (tried.join(", ") || "—"),
    );
  }
  if (!within("AI-Suplex Kick-start/Context Kick-start/Active", file)) {
    throw new Error("context path escapes Active/");
  }

  const d = new Date();
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const stem = path.basename(file, ".md");
  const block =
    `\n---\n\n## 🗓️ SAVE — appended ${ts} · \`${stem}\`\n\n${args.body}\n\n---\n\n` +
    `*SAVE appended ${ts} · instance: \`${stem}\` · AGENTS.md unchanged (not the daily-tasks thread).*\n`;
  fs.appendFileSync(file, block);
  return text({ ok: true, path: path.relative(VAULT, file) });
}

function approve(args) {
  const r = cli.run("approvals", ["--json"]);
  if (!r.ok) throw new Error(r.stderr || "approvals failed");
  const inbox = JSON.parse(r.stdout);

  if (args.decision !== "approve") {
    return text({ ok: true, decision: "reject", item: args.item, executed: null });
  }

  const gate = (inbox.gates || []).find((g) => g.path === args.item || g.path.endsWith(args.item));
  if (gate) {
    const abs = path.join(VAULT, gate.path);
    if (!within("Artifacts", abs)) throw new Error("gate path escapes Artifacts/");
    let src = fs.readFileSync(abs, "utf8");
    if (/^status:\s*in-battle\s*$/m.test(src)) {
      src = src.replace(/^status:\s*in-battle\s*$/m, "status: clear");
      fs.writeFileSync(abs, src);
      return text({ ok: true, decision: "approve", item: gate.path, executed: "flipped status: in-battle -> clear" });
    }
    return text({ ok: true, decision: "approve", item: gate.path, executed: "no-op (status not in-battle)" });
  }

  if (args.item === "lessons" || args.item === "promote") {
    const p = cli.run("3lm", ["promote", "--min", "70"]);
    return text({ ok: p.ok, decision: "approve", item: args.item, executed: "3lm promote --min 70", status: p.status, stdout: p.stdout, stderr: p.stderr });
  }

  throw new Error("unknown approval item: " + args.item + " (see suplex://approvals)");
}

function call(name, args) {
  args = args || {};
  switch (name) {
    case "suplex_status": {
      const r = cli.run("asmc", ["status", "--json"]);
      if (!r.ok) throw new Error(r.stderr || "asmc status failed");
      return text(r.stdout);
    }
    case "suplex_tasklist_next": {
      const r = cli.run("asmc", ["status", "--json"]);
      if (!r.ok) throw new Error(r.stderr || "asmc status failed");
      const s = JSON.parse(r.stdout);
      const open = (s.tasklists || []).filter((t) => t.status === "active" || t.status === "parked");
      const next = open.find((t) => t.next);
      return text(next ? { tasklist: next.file, title: next.title, next: next.next, nextTitle: next.nextTitle } : { next: null });
    }
    case "suplex_capture":
      return capture(args);
    case "suplex_save_context":
      return saveContext(args);
    case "suplex_close": {
      const argv = ["close"].concat(args.dryRun ? ["--dry-run"] : []);
      const r = cli.run("asmc", argv);
      return text({ ok: r.ok, status: r.status, stdout: r.stdout, stderr: r.stderr });
    }
    case "suplex_index": {
      const r = cli.run("3lm", ["index"]);
      return text({ ok: r.ok, status: r.status, stdout: r.stdout, stderr: r.stderr });
    }
    case "suplex_promote": {
      if (args.approved !== true) throw new Error("suplex_promote requires approved: true (the Hustler gate)");
      const min = Number.isFinite(args.min) ? args.min : 70;
      const r = cli.run("3lm", ["promote", "--min", String(min)]);
      return text({ ok: r.ok, status: r.status, stdout: r.stdout, stderr: r.stderr });
    }
    case "suplex_approve":
      return approve(args);
    case "suplex_ritual": {
      if (args.approved !== true) throw new Error("suplex_ritual requires approved: true (the Hustler gate)");
      const argv = [args.which, "--tier", args.tier || "auto"];
      if (args.run === true) argv.push("--run");
      const r = cli.run("ritual", argv);
      return text({ ok: r.ok, status: r.status, stdout: r.stdout, stderr: r.stderr });
    }
    default:
      throw new Error("unknown tool: " + name);
  }
}

module.exports = { list, call, TOOLS };
