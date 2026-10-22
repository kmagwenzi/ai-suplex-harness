#!/usr/bin/env node
"use strict";

/**
 * contract.test.js — the harness-side check of the frozen mcp v1 surface (2026-10-21).
 *
 * The framework owns contract.json; the harness only projects it. This test runs the
 * extracted server and proves the projection still matches the vault the checkout is
 * linked to — so a green run here means the published repo is not lying.
 *
 * Usage: node test/contract.test.js
 *   exit 0 = pass, 1 = regression. The vault resolves exactly like the server:
 *   AISUPLEX_VAULT, then vault.json (written by `node link.js <vault>`).
 *   Dependency-free (Node 20 stdlib). No node:sqlite.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "server.js");

const FROZEN = {
  resources: ["context", "mission", "threads", "tasklists", "tasklist", "memory/index", "memory/lessons", "approvals"],
  tools: ["suplex_status", "suplex_tasklist_next", "suplex_capture", "suplex_save_context", "suplex_close", "suplex_index", "suplex_promote", "suplex_approve", "suplex_ritual"],
  prompts: ["session-start", "session-end-report", "artifact-capture", "save-context", "tasklist-generation", "weekly-review", "b-bomb-promotion"],
};

/** The keys --contract publishes. The rest is internal wiring, deliberately omitted. */
const PUBLIC = ["contract", "semver", "tier", "framework_min", "capabilities", "resources", "tools", "prompts", "writes", "never"];
const INTERNAL = ["resourceMap", "mappings"];

let checks = 0;
let failures = 0;
function check(cond, msg) {
  checks++;
  console.log((cond ? "  [ok]   " : "  [FAIL] ") + msg);
  if (!cond) failures++;
}
const sorted = (a) => (Array.isArray(a) ? [...a].sort() : a);
/** Stable stringify — object key order must never decide a pass. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
    return out;
  }
  return v;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function linkedVault() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, "vault.json"), "utf8")).vault;
    return typeof p === "string" && p.trim() ? path.resolve(ROOT, p.trim()) : null;
  } catch {
    return null;
  }
}
function resolveVault() {
  if (process.env.AISUPLEX_VAULT) return path.resolve(process.env.AISUPLEX_VAULT);
  return linkedVault();
}

function summary() {
  console.log("");
  if (failures) console.log("FAIL — " + failures + " of " + checks + " checks failed.");
  else console.log("PASS — " + checks + " checks: the harness still projects mcp v1.");
  process.exit(failures ? 1 : 0);
}

// ── 1 · the link ─────────────────────────────────────────────────────────────
console.log("── link ──");
const VAULT = resolveVault();
check(!!VAULT, "the checkout is linked to a vault (AISUPLEX_VAULT or vault.json)");
if (!VAULT) {
  console.log("         → node link.js /path/to/AI-Suplex-777");
  summary();
}
check(fs.existsSync(path.join(VAULT, "period.md")), "the linked vault carries the period.md marker");

// ── 2 · the framework contract ───────────────────────────────────────────────
console.log("\n── vault contract ──");
const CONTRACT_PATH = path.join(VAULT, "contract.json");
check(fs.existsSync(CONTRACT_PATH), "the linked vault ships contract.json");
let file = null;
try {
  if (fs.existsSync(CONTRACT_PATH)) file = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
} catch (e) {
  check(false, "contract.json parses — " + e.message);
}
check(!!file, "contract.json loads");
if (!file) summary();

// ── 3 · the live surface ─────────────────────────────────────────────────────
console.log("\n── live server ──");
const r = spawnSync(process.execPath, [SERVER, "--contract"], {
  cwd: ROOT,
  encoding: "utf8",
  timeout: 15000,
  env: Object.assign({}, process.env, { AISUPLEX_VAULT: VAULT }),
});
check(r.status === 0, "the server answers --contract (exit 0)" + (r.status === 0 ? "" : " — " + (r.stderr || "").trim()));
let live = null;
try {
  live = JSON.parse(r.stdout);
} catch (e) {
  check(false, "the server --contract prints JSON — " + e.message);
}
check(!!live, "the live surface parses");
if (!live) summary();

// ── 4 · the frozen surface ──────────────────────────────────────────────────
console.log("\n── frozen surface ──");
check(live.contract === "mcp v1", "contract id is mcp v1 (" + live.contract + ")");
check(live.tier === "free", "tier is free on this checkout (" + live.tier + ")");
for (const k of ["resources", "tools", "prompts"]) {
  check(same(live[k], FROZEN[k]), "live " + k + " match the frozen v1 surface (" + (Array.isArray(live[k]) ? live[k].length : "?") + ")");
  if (Array.isArray(live[k]) && !same(live[k], FROZEN[k])) {
    console.log("         surface change is a reviewable act: update BOTH contract.json and this test.");
  }
}

// ── 5 · the projection ──────────────────────────────────────────────────────
console.log("\n── projection of contract.json ──");
for (const k of PUBLIC) check(k in live, "publishes " + k);
for (const k of PUBLIC.filter((x) => x in live)) check(same(live[k], file[k]), "live " + k + " matches contract.json");
for (const k of INTERNAL) check(!(k in live), k + " is internal and not exposed");

// ── 6 · the free path ───────────────────────────────────────────────────────
console.log("\n── free path ──");
const jsFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "test") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) jsFiles.push(p);
  }
})(ROOT);
const sqlite = jsFiles.filter((f) => fs.readFileSync(f, "utf8").includes("node:sqlite"));
check(sqlite.length === 0, "no node:sqlite on the free path (" + jsFiles.length + " js files)");
check(sorted(live.tools).indexOf("suplex_sync") < 0, "3lm sync is not on the surface (D4)");

summary();
