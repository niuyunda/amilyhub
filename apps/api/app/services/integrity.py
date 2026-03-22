from ..repositories.integrity import run_integrity_checks


def check_data_integrity(*, limit: int) -> dict[str, object]:
    issues = run_integrity_checks()
    return {
        "ok": True,
        "data": {
            "has_issues": len(issues) > 0,
            "issue_count": len(issues),
            "issues": issues[:limit],
        },
    }
