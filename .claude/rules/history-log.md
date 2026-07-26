# 📜 Keep the project history current

Loaded in every session. `docs/History.md` is the shared context for any developer and any
fresh Claude Code session — keep it accurate and current.

## The rule
After **every meaningful step** — a feature/endpoint built, a model or migration, a decision
or deviation, a dependency added, a config/security change, a gotcha discovered, or an item
put on hold — **append an entry to the "Change log" at the top of `docs/History.md`.**

Each entry, one line or two:
- **Date** (absolute, e.g. 2026-07-26),
- **what** changed,
- **why** / any decision, and any **gotcha** worth saving.

Newest entry goes at the **top** of the change log.

## Also
- If a change alters the bigger picture (scope, decisions, gotchas, how-to-run, gaps), update
  the relevant **section** of `docs/History.md` too — not just the change log.
- Keep it concise and truthful: record what was actually done, what was skipped, and why.
- Trivial edits (typo, formatting) don't need an entry; anything a new dev would want to know does.
