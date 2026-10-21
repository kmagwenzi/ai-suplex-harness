#!/usr/bin/env node
"use strict";

/**
 * link.js — bind this harness checkout to an AI-Suplex vault.
 *
 * The harness is a window over a vault, not a copy of it. After extraction it
 * cannot find the vault by walking up the tree, so the link is explicit:
 *
 *   node link.js /path/to/AI-Suplex-777   # write vault.json
 *   node link.js --show                   # what will the server use?
 *   node link.js --clear                  # remove the local link
 *
 * Resolution order stays: AISUPLEX_VAULT > vault.json > walk-up > fallback.
 * vault.json is machine-local and gitignored; only this file records it.
 */

const fs = require("fs");
const path = require("path");

const HARNESS_ROOT = __dirname;
const LINK_FILE = path.join(HARNESS_ROOT, "vault.json");

const USAGE = `usage:
  node link.js <vault-path>   link this harness to a vault
  node link.js --show         print the vault the server would use
  node link.js --clear        remove the local link`;

/** @param {string} p @returns {string[]} */
function missingMarkers(p) {
  const missing = [];
  if (!fs.existsSync(path.join(p, "period.md"))) missing.push("period.md");
  if (!fs.existsSync(path.join(p, "contract.json"))) missing.push("contract.json");
  return missing;
}

function readLink() {
  try {
    const data = JSON.parse(fs.readFileSync(LINK_FILE, "utf8"));
    return typeof data.vault === "string" ? path.resolve(HARNESS_ROOT, data.vault) : null;
  } catch {
    return null;
  }
}

/** Same order as lib/vault.js, but without requiring it (it may throw). */
function current() {
  const env = process.env.AISUPLEX_VAULT;
  if (env) return { source: "AISUPLEX_VAULT", vault: path.resolve(env) };
  const linked = readLink();
  if (linked) return { source: "vault.json", vault: linked };
  let dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(dir, "period.md"))) return { source: "walk-up", vault: dir };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { source: "fallback", vault: path.resolve(__dirname, "..", "..") };
}

function link(target) {
  const vault = path.resolve(process.cwd(), target);
  const missing = missingMarkers(vault);
  if (missing.length) {
    console.error(`Not a vault: ${vault}`);
    console.error(`  missing: ${missing.join(", ")}`);
    process.exit(1);
  }
  const contract = JSON.parse(fs.readFileSync(path.join(vault, "contract.json"), "utf8"));
  fs.writeFileSync(
    LINK_FILE,
    JSON.stringify({ vault, linked_at: new Date().toISOString() }, null, 2) + "\n",
  );
  console.log(`Linked harness -> ${vault}`);
  console.log(`  contract: ${contract.contract} ${contract.semver} (framework >= ${contract.framework_min})`);
  console.log(`  link file: ${LINK_FILE}`);
}

function show() {
  const { source, vault } = current();
  const missing = missingMarkers(vault);
  console.log(`vault:  ${vault}`);
  console.log(`source: ${source}`);
  if (missing.length) {
    console.error(`status: UNLINKED (missing ${missing.join(", ")})`);
    console.error("  link it: node link.js /path/to/AI-Suplex-777");
    process.exit(1);
  }
  console.log("status: OK");
}

function clear() {
  if (fs.existsSync(LINK_FILE)) {
    fs.unlinkSync(LINK_FILE);
    console.log(`Removed ${LINK_FILE}`);
  } else {
    console.log("No local link to remove.");
  }
}

const arg = process.argv.slice(2);
if (arg.length === 0 || arg[0] === "-h" || arg[0] === "--help") {
  console.log(USAGE);
} else if (arg[0] === "--show") {
  show();
} else if (arg[0] === "--clear") {
  clear();
} else {
  link(arg[0]);
}
