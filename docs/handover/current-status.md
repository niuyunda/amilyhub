# Current Status

## Summary
- Export milestone reached: migration-critical datasets are fully exported and consolidated.

## Completed
- Root handover router created: `AGENT_ENTRY.md`
- Core docs skeleton created under `/docs`
- API discovery (menu + deep + hidden actions) completed for key business domains.
- Segmented/resumable export pipeline implemented.
- Exported datasets delivered and summarized:
  - teachers, students_learning, orders, income_expense, hour_cost_flows
  - rollcalls via browser async export fallback (xls)
- Export summary + milestone docs completed.

## In Progress
- Normalization and import-staging documentation.

## Next Actions
1. Convert rollcalls xls to normalized structured format.
2. Build source-to-target field mapping doc for DB import.
3. Produce import sequencing and validation report (counts/nulls/duplicates/FK match).
4. Generate coding-agent task pack for implementation of import pipeline.

## Risks / Blockers
- Some APIs only appear under specific role states or popup workflows.
