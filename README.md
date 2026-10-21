# ai-suplex-harness — `mcp v1`

The **MCP server** that turns the AI-Suplex vault into a window any MCP client
(AionUI · Claude Code · Cursor · …) can open. **Dependency-free** (Node 20 stdlib).

> **The vault is the source of truth; MCP is the seam; the UI is a window.**
> See `CONTRACT.md` and `AI-Suplex Kick-start/Spec — MCP Contract (mcp v1).md`.

## Run

```bash
node server.js             # stdio server (JSON-RPC 2.0, newline-delimited)
node server.js --contract  # the frozen surface (JSON) — what contract.test.js compares
```

The server resolves the vault from `AISUPLEX_VAULT`, then `vault.json` (the
repo-local link), then by walking up to `period.md`, then the co-located path.
**No `cwd` assumption.**

## Link a vault

An extracted checkout has no vault beside it. Link it once:

```bash
node link.js /path/to/AI-Suplex-777   # writes vault.json (gitignored)
node link.js --show                   # vault path + which rule resolved it
node link.js --clear                  # remove the link
```

`AISUPLEX_VAULT` still overrides the link, so CI and one-off runs stay
stateless. An unlinked checkout fails with `AISUPLEX_VAULT_UNLINKED` and the
link command, instead of an `ENOENT` on the wrong `contract.json`.


## What it exposes

| Kind | Items |
|---|---|
| **Resources (8)** | `suplex://context` · `mission` · `threads` · `tasklists` · `tasklist/{path}` · `memory/index` · `memory/lessons` · `approvals` |
| **Tools (9)** | `suplex_status` · `suplex_tasklist_next` · `suplex_capture` · `suplex_save_context` · `suplex_close` · `suplex_index` · `suplex_promote` · `suplex_approve` · `suplex_ritual` |
| **Prompts (7)** | `session-start` · `session-end-report` · `artifact-capture` · `save-context` · `tasklist-generation` · `weekly-review` · `b-bomb-promotion` |

## The boundary

- The **framework** is the only writer; every tool shells out to `Tools/{asmc,3lm,approvals,ritual}.js`.
- The two **declared file-writes** are `suplex_capture` and `suplex_save_context`, both path-contained.
- **`3lm sync` is not on the surface** (D4) — the UI is not a committer.
- The **Hustler gate** is `approved: true` on promote / approve / ritual.

## Files

| File | Role |
|---|---|
| `server.js` | stdio JSON-RPC loop · `--contract` · dispatch |
| `resources.js` | the 8 read-only views |
| `tools.js` | the 9 tools (CLI wrappers + 2 file-writes + gate) |
| `prompts.js` | the 7 prompts → `Prompt Patterns/` |
| `lib/cli.js` | one tool = one CLI invocation |
| `lib/vault.js` | vault root · contract load · cycle/week · containment |
| `link.js` | bind this checkout to a vault (`vault.json`) |
| `aionui/` | the **`ai-suplex-ui`** seed (moves to its own repo) |

## Repo extraction (→ `ai-suplex-harness` + `ai-suplex-ui`)

```
ai-suplex-harness/          ai-suplex-ui/
├── server.js               ├── mcp.json
├── resources.js            ├── configure.js
├── tools.js                ├── assistant.md
├── prompts.js              └── README.md
├── lib/{cli,vault}.js
├── link.js
├── README.md
├── CONTRACT.md
└── package.json
```

**Rule:** `ai-suplex-ui` is **config only** — it depends on `mcp v1`, never on framework code.
The harness depends on the framework **CLI**, never on its memory.

## Verified

- `--contract` matches `contract.json` (the contract test's live check).
- `suplex://context` returns the operator brief (Cycle 3 W1 · 6 instances · 19 tasklists · 0 stale).
- AionUI: `mcp_servers.last_test_status = connected`.
- 25/25 suites green · `grep node:sqlite Tools/*.js` empty.
