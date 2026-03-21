import argparse
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import psycopg


def normalize_course_name(v: str) -> str:
    s = str(v or "").strip()
    if s.startswith("课程【") and s.endswith("】"):
        return s[3:-1]
    return s


def to_num(v, default=0.0):
    try:
        if v is None or v == "":
            return float(default)
        return float(v)
    except Exception:
        return float(default)


def _convert_dt(s: str) -> str:
    s = str(s or "").strip()
    if not s:
        return s
    try:
        dt = datetime.strptime(s, "%Y-%m-%d %H:%M")
        dt = dt.replace(tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(ZoneInfo("Pacific/Auckland"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return s


def _convert_range(s: str) -> str:
    s = str(s or "").strip()
    if not s or "~" not in s:
        return s
    left, right = s.split("~", 1)
    left = left.strip()
    right = right.strip()
    try:
        start = datetime.strptime(left, "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(ZoneInfo("Pacific/Auckland"))
        if len(right) == 5:
            end_src = datetime.strptime(f"{left[:10]} {right}", "%Y-%m-%d %H:%M")
        else:
            end_src = datetime.strptime(right, "%Y-%m-%d %H:%M")
        if end_src < datetime.strptime(left, "%Y-%m-%d %H:%M"):
            end_src = end_src + timedelta(days=1)
        end = end_src.replace(tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(ZoneInfo("Pacific/Auckland"))
        return f"{start.strftime('%Y-%m-%d %H:%M')}~{end.strftime('%H:%M')}"
    except Exception:
        return s


def import_xls(db_url: str, xls_path: Path):
    df = pd.read_excel(xls_path).fillna("")
    records = df.to_dict(orient="records")

    grouped: dict[str, dict] = {}
    for r in records:
        rollcall_time = _convert_dt(str(r.get("点名时间", "")).strip())
        class_name = str(r.get("班级名称", "")).strip()
        class_time_range = _convert_range(str(r.get("上课时间", "")).strip())
        teacher_name = str(r.get("授课老师", "")).strip()
        course_name = normalize_course_name(str(r.get("消耗方式", "")).strip())
        status = str(r.get("学员类型", "正常")).strip() or "正常"

        session_key = "||".join([rollcall_time, class_name, class_time_range, teacher_name])
        row_hash = hashlib.md5(session_key.encode("utf-8")).hexdigest()

        g = grouped.get(row_hash)
        if not g:
            g = {
                "source_row_hash": row_hash,
                "rollcall_time": rollcall_time,
                "class_name": class_name,
                "course_name": course_name,
                "teacher_name": teacher_name,
                "class_time_range": class_time_range,
                "status": status,
                "cost_amount_cents": 0,
                "actual_students": 0,
                "total_students": 0,
                "teaching_hours": 0.0,
                "students": [],
            }
            grouped[row_hash] = g

        arrive = str(r.get("到课状态", "")).strip()
        cost_yuan = to_num(r.get("课消金额", 0), 0.0)
        deduct_hours = to_num(r.get("扣课时", 0), 0.0)

        g["total_students"] += 1
        if arrive == "到课":
            g["actual_students"] += 1
        g["cost_amount_cents"] += int(round(cost_yuan * 100))
        g["teaching_hours"] = max(g["teaching_hours"], deduct_hours)

        g["students"].append(
            {
                "student_name": str(r.get("学生姓名", "")).strip(),
                "phone": str(r.get("电话", "")).strip(),
                "consume_way": str(r.get("消耗方式", "")).strip(),
                "arrival_status": arrive or "-",
                "makeup_status": str(r.get("补课状态", "")).strip() or "-",
                "deduct_lessons": deduct_hours,
                "deduct_amount_yuan": cost_yuan,
                "remark": str(r.get("点名备注", "")).strip() or "-",
            }
        )

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("truncate table amilyhub.rollcalls")
            for g in grouped.values():
                attendance_summary = f"{g['actual_students']}/{g['total_students']}"
                student_names = "、".join([x["student_name"] for x in g["students"] if x["student_name"]])
                raw_json = {
                    "attendance_summary": attendance_summary,
                    "actual_students": g["actual_students"],
                    "total_students": g["total_students"],
                    "teaching_hours": g["teaching_hours"],
                    "student_names": student_names,
                    "students": g["students"],
                    "source_file": str(xls_path),
                }
                cur.execute(
                    """
                    insert into amilyhub.rollcalls(
                      source_row_hash, student_name, class_name, course_name, teacher_name,
                      rollcall_time, class_time_range, status, cost_amount_cents, raw_json
                    ) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                    """,
                    (
                        g["source_row_hash"],
                        "-",
                        g["class_name"],
                        g["course_name"],
                        g["teacher_name"],
                        g["rollcall_time"],
                        g["class_time_range"],
                        g["status"],
                        g["cost_amount_cents"],
                        json.dumps(raw_json, ensure_ascii=False),
                    ),
                )
            conn.commit()

    return {"student_rows": len(records), "sessions": len(grouped)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--xls", required=True)
    args = parser.parse_args()

    result = import_xls(args.db, Path(args.xls))
    print(json.dumps({"ok": True, **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
