"use strict";

/**
 * cli.js — one helper: run ONE framework CLI invocation and capture its output.
 *
 * This is the anti-drift rule made mechanical: an MCP tool never re-implements
 * logic; it shells out to Tools/<script> (Spec — MCP Contract §3, §8).
 */

const path = require("path");
const { spawnSync } = require("child_process");
const { VAULT } = require("./vault");

const SCRIPTS = {
  "3lm": "3lm.js",
  asmc: "asmc.js",
  approvals: "approvals.js",
  ritual: "ritual.js",
};

/**
 * @param {string} script  a key of SCRIPTS (3lm · asmc · approvals · ritual)
 * @param {string[]} args
 * @param {{timeout?:number}} [opts]
 * @returns {{ok:boolean,status:number,stdout:string,stderr:string}}
 */
function run(script, args, opts) {
  const file = path.join(VAULT, "Tools", SCRIPTS[script] || script);
  const r = spawnSync(process.execPath, [file, ...args], {
    cwd: VAULT,
    encoding: "utf8",
    timeout: (opts && opts.timeout) || 120000,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

/** Parse stdout as JSON, or null. */
function json(r) {
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

module.exports = { run, json };
