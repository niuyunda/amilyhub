import json
import pathlib
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
from app.db import get_conn

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'28384cf0b2c5498e918f4096401f0cc9','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','originPath':'https://b.xiaomai5.com/#/class_record/take_name_record','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','uid':'1219458615660421122','tid':'','token':'28384cf0b2c5498e918f4096401f0cc9','xmToken':'28384cf0b2c5498e918f4096401f0cc9','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}


def nz(v, d=0):
    try:
        return float(v or d)
    except Exception:
        return float(d)


def fmt_ms(ms: int | None):
    if not ms:
        return "-"
    dt = datetime.fromtimestamp(ms / 1000, tz=ZoneInfo("Pacific/Auckland"))
    return dt.strftime("%Y-%m-%d %H:%M")


def fmt_range(start_ms: int | None, end_ms: int | None):
    if not start_ms:
        return "-"
    s = datetime.fromtimestamp(start_ms / 1000, tz=ZoneInfo("Pacific/Auckland"))
    if not end_ms:
        return s.strftime("%Y-%m-%d %H:%M")
    e = datetime.fromtimestamp(end_ms / 1000, tz=ZoneInfo("Pacific/Auckland"))
    return f"{s.strftime('%Y-%m-%d %H:%M')}~{e.strftime('%H:%M')}"


def run():
    page = 1
    size = 200
    all_rows = []
    while True:
        body = {"current": page, "size": size, "stateFilter": "1"}
        r = requests.post(BASE + '/business/public/rollCall/queryInstRollCalls', params=Q, headers=H, json=body, timeout=30).json()
        if str(r.get('code')) != '200':
            raise SystemExit(r)
        res = r.get('result') or {}
        records = res.get('records') or []
        all_rows.extend(records)
        pages = int(res.get('pages') or 1)
        if page >= pages:
            break
        page += 1

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute('truncate table amilyhub.rollcalls')
            for x in all_rows:
                rid = str(x.get('id') or '')
                class_name = x.get('className') or '-'
                course_name = x.get('courseName') or '-'
                teachers = x.get('classTeacherNames') or []
                teacher_name = '、'.join([str(t) for t in teachers]) if isinstance(teachers, list) else str(teachers or '-')
                status = '正常' if int(x.get('state') or 0) == 1 else '已作废'
                checked_hour = nz(x.get('checkedClassHour'), 0)
                attend = int(nz(x.get('attendNumber'), 0))
                total = int(nz(x.get('totalNumber'), 0))
                attendance_summary = f"{attend}/{total}" if total else '0/0'
                rollcall_time = fmt_ms(int(x.get('signDate') or 0))
                class_time_range = fmt_range(int(x.get('classStartDate') or 0), int(x.get('classEndDate') or 0))
                cost_cents = int(round(nz(x.get('checkedCost'), 0) * 100))
                raw = dict(x)
                raw.update({
                    'teaching_hours': checked_hour,
                    'attendance_summary': attendance_summary,
                    'actual_students': attend,
                    'total_students': total,
                    'student_names': '-',
                    'students': [],
                    'source': 'queryInstRollCalls',
                })
                cur.execute(
                    '''
                    insert into amilyhub.rollcalls(source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_amount_cents, raw_json)
                    values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                    ''',
                    (rid, '-', class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_cents, json.dumps(raw, ensure_ascii=False)),
                )
            conn.commit()
    print(json.dumps({'ok': True, 'rows': len(all_rows)}, ensure_ascii=False))


if __name__ == '__main__':
    run()
