# Current Status

## Summary
- Documentation framework initialized.
- Round-2 deep scan completed for high-priority data modules.

## Completed
- Root handover router created: `AGENT_ENTRY.md`
- Core docs skeleton created under `/docs`
- Initial menu-level API scan completed.
- Deep scan completed for key domains: 学生/老师/订单/上课记录/收支明细/课消记录.

## In Progress
- Mutation and detail-action endpoint coverage (create/edit/export/import/detail/日志).

## Next Actions
1. In each key page, click row-level actions (详情/编辑/操作日志/课后点评) and capture additional detail APIs.
2. Trigger import/export and create/edit dialogs to capture write endpoints.
3. Build deduplicated endpoint matrix with method/path/params/response-top-level fields.
4. Start exporter design doc with checkpoint + retry + incremental strategy.

## Risks / Blockers
- Some APIs only appear under specific role states or popup workflows.
