"use strict";

/**
 * vault.js — resolve the vault root + load the frozen contract.
 *
 * The server is a **window**: it reads the contract and the vault, and shells out
 * to the framework CLI. It never owns memory (Spec — MCP Contract §7–§8).
 */

const fs = require("fs");
const path = require("path");

/** The harness repo root (lib/ -> ..), where the local vault link lives. */
const HARNESS_ROOT = path.resolve(__dirname, "..");

/**
 * Read the repo-local link written by `node link.js <vault>`.
 * Shape: { "vault": "<absolute path or path relative to the harness>" }
 * @returns {string|null} absolute vault path, or null
 */
function linkedVault() {
  try {
    const raw = fs.readFileSync(path.join(HARNESS_ROOT, "vault.json"), "utf8");
    const p = JSON.parse(raw).vault;
    return typeof p === "string" && p.trim() ? path.resolve(HARNESS_ROOT, p.trim()) : null;
  } catch {
    return null;
  }
}

/** A vault root is a directory containing the period.md marker. */
function isVault(p) {
  return !!p && fs.existsSync(path.join(p, "period.md"));
}

/**
 * Resolve the vault root. Portability matters: the harness runs co-located
 * (Tools/mcp/) today and from its own repo after extraction.
 *   1. AISUPLEX_VAULT (explicit — wins everywhere, including CI)
 *   2. vault.json in the harness root (the local link; see link.js)
 *   3. walk up to the nearest ancestor with period.md (the vault marker)
 *   4. co-located fallback: Tools/mcp/lib -> ../../..
 */
function resolveVault() {
  const env = process.env.AISUPLEX_VAULT;
  if (env) {
    const p = path.resolve(env);
    if (fs.existsSync(path.join(p, "period.md")) || fs.existsSync(path.join(p, "contract.json"))) return p;
  }
  const linked = linkedVault();
  if (isVault(linked)) return linked;
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

/** Load the frozen contract, or fail with an actionable "not linked" message. */
function loadContract() {
  const file = path.join(VAULT, "contract.json");
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    const err = new Error(
      [
        `AI-Suplex vault not linked: ${VAULT}`,
        `  expected contract: ${file}`,
        "",
        "Link the harness to its vault once:",
        "  node link.js /path/to/AI-Suplex-777",
        "",
        "Or set the environment variable for a single run:",
        "  AISUPLEX_VAULT=/path/to/AI-Suplex-777 node server.js",
      ].join("\n"),
    );
    err.code = "AISUPLEX_VAULT_UNLINKED";
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error(`Contract at ${file} is not valid JSON: ${e.message}`);
    err.code = "AISUPLEX_CONTRACT_INVALID";
    throw err;
  }
}

const CONTRACT = loadContract();

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
