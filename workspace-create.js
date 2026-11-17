"use strict";

/**
 * workspace-create.js — open an N-lane workspace: one instance context file
 * and one tasklist, written as the markdown the vault accepts.
 *
 * Additive to mcp v1 (contract 1.2.0). Declared write scope:
 *   Tasklists/Active/**  ·  AI-Suplex Kick-start/Context Kick-start/Active/**
 * Singletons (daily-tasks, realist) are refused — the framework owns them.
 */

function create(args, d) {
  const LANES = ["project-tasks", "random-tasks"];
  const thread = String(args.thread || "").trim();
  if (!LANES.includes(thread)) {
    throw new Error(
      "thread must be one of: " + LANES.join(", ") +
        " (daily-tasks and realist are singletons — the framework opens them)",
    );
  }
  const slugName = String(args.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slugName)) {
    throw new Error("slug must be kebab-case: lowercase a-z, digits, single dashes");
  }
  const title = String(args.title || "").trim();
  if (!title) throw new Error("title is required");
  const mission = String(args.mission || "").trim();
  if (!mission) throw new Error("mission is required");
  const focus = d.slug(args.focus || "digital-products");
  const tasks = Array.isArray(args.tasks)
    ? args.tasks.map((t) => String(t).trim()).filter(Boolean).slice(0, 24)
    : [];

  const { cycle, week } = d.detectCycleWeek();
  if (!cycle || !week) {
    throw new Error("could not detect the current cycle/week — run `node Tools/vault-index.js --current` first");
  }

  const activeRel = "AI-Suplex Kick-start/Context Kick-start/Active";
  const activeDir = d.path.join(d.VAULT, activeRel);
  let maxRef = 0;
  for (const f of d.fs.readdirSync(activeDir)) {
    const m = f.match(new RegExp("^" + thread + "-(\\d+)-"));
    if (m) maxRef = Math.max(maxRef, parseInt(m[1], 10));
  }
  const ref = maxRef + 1;

  const now = new Date();
  const date = `${now.getFullYear()}-${d.pad(now.getMonth() + 1)}-${d.pad(now.getDate())}`;
  const opened = `${date}T${d.pad(now.getHours())}:${d.pad(now.getMinutes())}`;
  const instanceRel = `${activeRel}/${thread}-${ref}-${slugName}.md`;
  const tasklistRel = `Tasklists/Active/${date}-${thread}-${slugName}-tasklist.md`;
  const instanceAbs = d.path.join(d.VAULT, instanceRel);
  const tasklistAbs = d.path.join(d.VAULT, tasklistRel);

  if (!d.within(activeRel, instanceAbs)) throw new Error("instance path escapes Active/");
  if (!d.within("Tasklists/Active", tasklistAbs)) throw new Error("tasklist path escapes Tasklists/Active/");
  if (d.fs.existsSync(instanceAbs)) throw new Error("instance already exists: " + instanceRel);
  if (d.fs.existsSync(tasklistAbs)) throw new Error("tasklist already exists: " + tasklistRel);

  const tasklistStem = `${date}-${thread}-${slugName}-tasklist`;
  const instanceBody = [
    "---",
    `thread: ${thread}`,
    `instance: ${ref}`,
    `mission: ${d.yamlStr(mission)}`,
    `slug: ${slugName}`,
    "status: open",
    "writer: committer",
    "agent: local",
    `opened: ${opened}`,
    `cycle: ${cycle}`,
    `week: ${week}`,
    "parent: null",
    "---",
    "",
    `# ${title}`,
    "",
    `**Ref ${ref} · opened ${opened}.** ${mission}`,
    "",
    "## Pointers",
    "",
    `- **Tasklist:** [[Tasklists/Active/${tasklistStem}]]`,
    `- **Focus:** ${focus} · **Cycle ${cycle}, Week ${week}**`,
    "",
    "## Status",
    "",
    "- [ ] open the tasklist and start Phase 0",
    "",
  ].join("\n");

  const rows = tasks.map((task, i) => {
    const id = "S" + String(i + 1).padStart(3, "0");
    return `| ${id} | Builder | 30m | ${task.replace(/\|/g, "\\|")} | Execution |`;
  });
  const tasklistBody = [
    "---",
    "type: tasklist",
    `title: ${d.yamlStr(date + " — " + thread + " · " + title)}`,
    `date: ${date}`,
    "status: active",
    `cycle: ${cycle}`,
    `week: ${week}`,
    `thread: ${thread}`,
    "thread_status: open",
    `instance: ${thread}-${ref}-${slugName}`,
    `instance_slug: ${slugName}`,
    `focus: ${focus}`,
    `tags: [tasklist, ${thread}, ${slugName}]`,
    "---",
    "",
    `# ${title}`,
    "",
    `**Objective:** ${mission}`,
    "",
    "## Phase 0 — Context Core (5m)",
    "",
    "| ID | Role | Dur | Task | Nature |",
    "|----|------|-----|------|--------|",
    "| S000 | Builder | 5m | `node Tools/3lm.js start --context` · read the pointers · `git status -sb` | Execution |",
    "",
    "## Tasks",
    "",
    "| ID | Role | Dur | Task | Nature |",
    "|----|------|-----|------|--------|",
    ...(rows.length ? rows : ["| — | — | — | add tasks in the console | — |"]),
    "",
    "## Success Check",
    "",
    `- [ ] ${mission} — done, with the artifact that proves it`,
    "",
    "## Kill list",
    "",
    "- One writer per file — this lane writes its own context file only.",
    "- No claim of done without the artifact.",
    "",
    `*Tasklist opened from the console on ${date}. TWABAM ⚡*`,
    "",
  ].join("\n");

  d.fs.writeFileSync(instanceAbs, instanceBody);
  try {
    d.fs.writeFileSync(tasklistAbs, tasklistBody);
  } catch (e) {
    d.fs.rmSync(instanceAbs, { force: true });
    throw e;
  }

  // best-effort projection refresh — a failure here never undoes the write
  const r = d.cli.run("3lm", ["threads", "--list"]);

  return d.text({
    ok: true,
    ref,
    instance: instanceRel,
    tasklist: tasklistRel,
    threadsRefreshed: r.ok,
  });
}

module.exports = { create };
