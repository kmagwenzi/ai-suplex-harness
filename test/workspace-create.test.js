"use strict";

/**
 * workspace-create.test.js — the guards on the console write path.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { create } = require("../workspace-create");

let checks = 0;
let failures = 0;
function check(cond, msg) {
  checks++;
  console.log((cond ? "  [ok]   " : "  [FAIL] ") + msg);
  if (!cond) failures++;
}

function tmpVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suplex-ws-"));
  fs.writeFileSync(path.join(dir, "period.md"), "start: 2026-09-01\nend: 2027-08-31\n");
  fs.mkdirSync(path.join(dir, "Memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "Memory", "vault-context.md"), "# Vault Context\n\n> Cycle 3 · Week 5 · Generated\n");
  fs.mkdirSync(path.join(dir, "Tasklists", "Active"), { recursive: true });
  fs.mkdirSync(path.join(dir, "AI-Suplex Kick-start", "Context Kick-start", "Active"), { recursive: true });
  return dir;
}

function depsFor(vault) {
  return {
    fs,
    path,
    VAULT: vault,
    within: (root, abs) => abs.startsWith(path.join(vault, root) + path.sep),
    detectCycleWeek: () => ({ cycle: 3, week: 5 }),
    cli: { run: () => ({ ok: false }) },
    pad: (n) => String(n).padStart(2, "0"),
    slug: (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    yamlStr: (s) => JSON.stringify(String(s)),
    text: (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s) }] }),
  };
}

const base = {
  thread: "project-tasks",
  slug: "walk-the-dog",
  title: "Walk the dog",
  mission: "Prove a workspace can be born from the console",
  focus: "digital-products",
  tasks: ["write the thing", "check the thing"],
};

const vault = tmpVault();
const deps = depsFor(vault);

const res = JSON.parse(create(base, deps).content[0].text);
check(/^Tasklists\/Active\/\d{4}-\d{2}-\d{2}-project-tasks-walk-the-dog-tasklist\.md$/.test(res.tasklist), "tasklist lands in Tasklists/Active as {date}-{thread}-{slug}-tasklist.md");
check(res.instance === "AI-Suplex Kick-start/Context Kick-start/Active/project-tasks-1-walk-the-dog.md", "instance file is {thread}-{ref}-{slug}.md (ref 1)");

const inst = fs.readFileSync(path.join(vault, res.instance), "utf8");
const tl = fs.readFileSync(path.join(vault, res.tasklist), "utf8");
check(inst.startsWith("---\n"), "instance opens with frontmatter");
check(/\nthread: project-tasks\n/.test(inst), "instance frontmatter carries the thread");
check(/\ninstance: 1\n/.test(inst), "instance frontmatter carries the numeric ref");
check(/\nstatus: open\n/.test(inst), "instance is open");
check(tl.startsWith("---\ntype: tasklist\n"), "tasklist frontmatter declares type: tasklist");
check(/\nthread_status: open\n/.test(tl), "tasklist frontmatter carries thread_status");
check(/\ninstance_slug: walk-the-dog\n/.test(tl), "tasklist frontmatter carries instance_slug");
check(tl.includes("| S001 | Builder | 30m | write the thing | Execution |"), "tasks render as S0NN table rows");
check(tl.includes("## Success Check"), "tasklist ships a Success Check");

const second = JSON.parse(create({ ...base, slug: "second-lane" }, deps).content[0].text);
check(second.ref === 2, "a second lane takes ref 2, not a collision");

function refuses(fn, msg) {
  try {
    fn();
    check(false, msg);
  } catch (e) {
    check(true, msg);
  }
}
refuses(() => create({ ...base, thread: "daily-tasks" }, deps), "refuses daily-tasks (singleton)");
refuses(() => create({ ...base, thread: "realist" }, deps), "refuses realist (singleton)");
refuses(() => create({ ...base, slug: "Bad Slug!" }, deps), "refuses a non-kebab slug");
refuses(() => create({ ...base, mission: "" }, deps), "refuses an empty mission");
refuses(() => create(base, deps), "refuses to overwrite an existing instance");

const trapped = depsFor(vault);
trapped.within = () => false;
refuses(() => create({ ...base, slug: "escapes" }, trapped), "refuses a path outside the declared roots");

fs.rmSync(vault, { recursive: true, force: true });
console.log("");
console.log((failures ? "FAIL — " + failures + " of " + checks : "PASS — " + checks + " checks on the workspace writer") + ".");
process.exit(failures ? 1 : 0);
