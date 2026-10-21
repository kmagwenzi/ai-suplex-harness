"use strict";

/**
 * vault.js — resolve the vault root + load the frozen contract.
 *
 * The server is a **window**: it reads the contract and the vault, and shells out
 * to the framework CLI. It never owns memory (Spec — MCP Contract §7–§8).
 */

const fs = require("fs");
const path = require("path");

/**
 * Resolve the vault root. Portability matters: the harness runs co-located
 * (Tools/mcp/) today and from its own repo after extraction.
 *   1. AISUPLEX_VAULT (explicit — required when extracted)
 *   2. walk up to the nearest ancestor with period.md (the vault marker)
 *   3. co-located fallback: Tools/mcp/lib -> ../../..
 */
function resolveVault() {
  const env = process.env.AISUPLEX_VAULT;
  if (env) {
    const p = path.resolve(env);
    if (fs.existsSync(path.join(p, "period.md")) || fs.existsSync(path.join(p, "contract.json"))) return p;
  }
  let dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(dir, "period.md"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, "..", "..", "..");
}

const VAULT = resolveVault();

const CONTRACT = JSON.parse(fs.readFileSync(path.join(VAULT, "contract.json"), "utf8"));

/** Read a vault-relative file, or null. */
function read(rel) {
  try {
    return fs.readFileSync(path.join(VAULT, rel), "utf8");
  } catch {
    return null;
  }
}

/** Detect the current cycle/week from the generated vault-context. */
function detectCycleWeek() {
  const vc = read("Memory/vault-context.md") || "";
  const m =
    vc.match(/Cycle\s+(\d+)\s*·\s*Week\s+(\d+)/i) ||
    vc.match(/Cycle\s+(\d+)[^\n]*Week\s+(\d+)/i);
  return m ? { cycle: parseInt(m[1], 10), week: parseInt(m[2], 10) } : { cycle: null, week: null };
}

/** True when `abs` resolves inside `baseRel` (path-containment guard). */
function within(baseRel, abs) {
  const base = path.resolve(VAULT, baseRel);
  const t = path.resolve(abs);
  return t === base || t.startsWith(base + path.sep);
}

module.exports = { VAULT, CONTRACT, read, detectCycleWeek, within };
