# Runbook: Using Exported Data (for New Agents)

## Goal
Enable any new agent session to immediately locate, validate, and consume the exported source SaaS data.

## 1) Start Here
- Read: `AGENT_ENTRY.md`
- Then read:
  1. `docs/03-delivery/export-milestone-2026-03-20.md`
  2. `apps/api/exports/raw/export_20260320_130436/export_summary.json`
  3. `docs/handover/current-status.md`

## 2) Data Location
Export root:
`apps/api/exports/raw/export_20260320_130436/`

## 3) Dataset Inventory
- `teachers.jsonl`
- `students_learning.jsonl`
- `orders.jsonl`
- `income_expense.jsonl`
- `hour_cost_flows.jsonl`
- `rollcalls_export_student.xls`

## 4) Integrity Check
Use quick checks:
- `wc -l *.jsonl`
- compare with `export_summary.json`
- verify file non-empty and readable

## 5) Rollcalls Special Handling
Rollcalls are delivered as XLS export fallback (not JSONL). If needed for DB import:
1. Parse XLS to structured rows.
2. Normalize headers to snake_case.
3. Preserve original raw columns for traceability.

## 6) For Import Agents
Required outputs before DB load:
1. `field_mapping.md` (source -> target)
2. normalized CSV/JSONL per target table
3. import order plan (dimensions first, then facts)
4. validation report (counts, nulls, duplicates, FK hit-rate)

## 7) Do Not
- Do not overwrite raw export files.
- Do not rerun full export unless explicitly requested.
- Do not delete checkpoint files; they are audit evidence.
