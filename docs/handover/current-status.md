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
- Mutation endpoint coverage (create/update/delete/void/undo) and import/upload chain capture.

## Next Actions
1. Continue on key modules: capture 操作日志 / 课后点评 / 发起合同 / 作废订单 actions.
2. For import features (学员/班级), capture upload preflight/task polling endpoints without final destructive submit.
3. Build deduplicated endpoint matrix with method/path/params/response-top-level fields.
4. Start exporter design doc with checkpoint + retry + incremental strategy.

## Risks / Blockers
- Some APIs only appear under specific role states or popup workflows.
