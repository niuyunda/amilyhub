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
- Final missing parts: import upload chain + submit-stage mutation APIs.

## Next Actions
1. Use a safe test tenant/account to capture final-submit mutation endpoints (void/create/update/delete) without business risk.
2. Capture import full flow endpoints: upload preflight, file upload, async task polling, result retrieval.
3. Build deduplicated endpoint matrix with method/path/params/response-top-level fields.
4. Start exporter design doc with checkpoint + retry + incremental strategy.

## Risks / Blockers
- Some APIs only appear under specific role states or popup workflows.
