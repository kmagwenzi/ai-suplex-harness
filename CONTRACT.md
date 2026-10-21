# Contract — `mcp v1`

This repository implements **`mcp v1`**, which is **owned by the framework**.

- **Canonical spec:** `AI-Suplex Kick-start/Spec — MCP Contract (mcp v1).md` (RATIFIED 2026-10-20)
- **Executable form:** `contract.json` (shipped by the framework at the vault root)
- **Surface:** 8 resources · 9 tools · 7 prompts
- **Transport:** `stdio` first; `Streamable HTTP` on `127.0.0.1` for WebUI only

## Rules (Spec §8)

1. **One writer** — the framework writes the vault; the harness shells out.
2. **Thin wrappers** — one tool = one CLI invocation, or one declared file-write.
3. **No Ultra on the free path** — `tier: free` exposes no Ultra tool.
4. **Connect has no side effects** — a resource read never writes.
5. **The gate is explicit** — promote / approve / ritual-run require `approved: true`.
6. **The UI holds no memory.**
7. **One scheduler** — the harness owns cron; the UI does not schedule vault ops.
8. **The commit is the committer's** — `3lm sync` is not on the surface.
9. **Additive or breaking** — never change a tool's shape inside `v1`.
10. **Node 20 everywhere** — no `node:sqlite` on any free path.

> **Do not fork the contract.** Extend it additively (Ultra capabilities) or bump to `mcp v2`.
