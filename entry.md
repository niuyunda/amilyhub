# Agent Entry (Start Here)

## Read order (strict)
1. `README.md`
2. `docs/README.md`
3. `docs/handover/current-status.md`
4. `docs/handover/todo.md`

## Routing
- 想知道“现在到哪一步了” → `docs/handover/current-status.md`
- 想知道“下一步做什么” → `docs/handover/todo.md`
- 想知道“怎么跑数据库” → `docs/runbooks/postgres-docker-setup.md`
- 想知道“后端做到哪里了” → `docs/03-delivery/backend-implementation-status.md`

## Rule
更新任何阶段时，必须同步更新：
- `docs/handover/current-status.md`
- `docs/handover/todo.md`
- `docs/04-operations/work-log.md`

---

## New Session Hand-off Prompt (copy not required)
If this is a brand-new session with no prior chat context, follow this exactly:

1. Read the 4 files in **Read order (strict)**.
2. Do **not** redo completed work.
3. Execute from `docs/handover/todo.md` P0 top-down.
4. Before ending your turn, update:
   - `docs/handover/current-status.md`
   - `docs/handover/todo.md`
   - `docs/04-operations/work-log.md`

## What to reply first in a new session
After reading docs, first reply with:
1. One-paragraph summary of current project status.
2. Next 3 concrete actions you will perform now.
3. Any blocker (only if real blocker exists).
