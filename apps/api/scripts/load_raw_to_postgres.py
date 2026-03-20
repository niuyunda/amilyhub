import os, json, hashlib
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone
import psycopg
import pandas as pd

ROOT = Path(__file__).resolve().parents[1] / 'exports' / 'raw' / 'export_20260320_130436'
DB = os.getenv('DATABASE_URL')
if not DB:
    raise SystemExit('Set DATABASE_URL, e.g. postgresql://user:pass@localhost:55432/amilyhub')

def cents(v):
    if v in (None, ''): return None
    try: return int(Decimal(str(v)) * 100)
    except: return None

def to_date(v):
    if v in (None, ''):
        return None
    try:
        if isinstance(v, (int, float)):
            # assume epoch ms when large
            ts = float(v)
            if ts > 1e12:
                ts = ts / 1000.0
            return datetime.fromtimestamp(ts, tz=timezone.utc).date()
        s = str(v)
        if len(s) >= 10:
            return datetime.fromisoformat(s[:10]).date()
    except:
        return None
    return None

def pick(d, *keys):
    for k in keys:
        if k in d and d[k] not in (None, ''):
            return d[k]
    return None

def load_jsonl(path):
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                yield json.loads(line)

def run():
    conn = psycopg.connect(DB)
    cur = conn.cursor()
    cur.execute((Path(__file__).resolve().parents[1] / 'schema' / '001_init.sql').read_text())

    # teachers
    n=0
    for r in load_jsonl(ROOT/'teachers.jsonl'):
        cur.execute('''insert into amilyhub.teachers(source_teacher_id,source_admin_id,name,phone,gender,last_month_lessons,current_month_lessons,total_finished_lessons,raw_json)
                       values(%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (source_teacher_id) do update set raw_json=excluded.raw_json''',
                    (str(pick(r,'teacherId','adminId')), pick(r,'adminId'), pick(r,'teacherName','name'), pick(r,'phone'), pick(r,'gender'), pick(r,'lastMonthLessons'), pick(r,'currentMonthLessons'), pick(r,'totalFinishLessons'), json.dumps(r,ensure_ascii=False)))
        n+=1
    cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','teachers',%s,'ok')", (n,))

    # students
    n=0
    for r in load_jsonl(ROOT/'students_learning.jsonl'):
        sb = r.get('studentBasicVO') or {}
        sidv = pick(sb,'studentId') or pick(r,'studentId','id')
        if not sidv:
            continue
        sid = str(sidv)
        cur.execute('''insert into amilyhub.students(source_student_id,name,phone,gender,birthday,status,source_created_at,raw_json)
                       values(%s,%s,%s,%s,%s,%s,%s,%s) on conflict (source_student_id) do update set raw_json=excluded.raw_json''',
                    (sid, pick(sb,'name', 'studentName') or pick(r,'name'), pick(sb,'phone','mobile') or pick(r,'phone'), pick(sb,'genderEnum','gender') or pick(r,'gender'), to_date(pick(sb,'birthday')), pick(sb,'statusEnum','status') or pick(r,'status'), to_date(pick(sb,'created')), json.dumps(r,ensure_ascii=False)))
        n+=1
    cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','students',%s,'ok')", (n,))

    # orders
    n=0
    for r in load_jsonl(ROOT/'orders.jsonl'):
        oid = str(pick(r,'voucherId','businessId','id','businessNo'))
        if not oid: continue
        cur.execute('''insert into amilyhub.orders(source_order_id,source_student_id,order_type,order_state,receivable_cents,received_cents,arrears_cents,raw_json)
                       values(%s,%s,%s,%s,%s,%s,%s,%s) on conflict (source_order_id) do update set raw_json=excluded.raw_json''',
                    (oid, pick(r,'studentId'), pick(r,'businessType','orderType'), pick(r,'businessState','state'), cents(pick(r,'shouldFee','shouldAmount')), cents(pick(r,'realFee','realAmount')), cents(pick(r,'arrearsFee','arrearsAmount')), json.dumps(r,ensure_ascii=False)))
        n+=1
    cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','orders',%s,'ok')", (n,))

    # income_expense
    n=0
    for r in load_jsonl(ROOT/'income_expense.jsonl'):
        rid = str(pick(r,'id'))
        if not rid: continue
        cur.execute('''insert into amilyhub.income_expense(source_id,source_order_id,item_type,direction,amount_cents,operation_date,raw_json)
                       values(%s,%s,%s,%s,%s,%s,%s) on conflict (source_id) do update set raw_json=excluded.raw_json''',
                    (rid, pick(r,'businessNo','orderNo'), pick(r,'itemName','bizType'), pick(r,'type','direction'), cents(pick(r,'amount','money')), to_date(pick(r,'operationDate')), json.dumps(r,ensure_ascii=False)))
        n+=1
    cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','income_expense',%s,'ok')", (n,))

    # hour_cost_flows
    n=0
    for r in load_jsonl(ROOT/'hour_cost_flows.jsonl'):
        rid = str(pick(r,'id'))
        if not rid: continue
        cur.execute('''insert into amilyhub.hour_cost_flows(source_id,source_student_id,source_teacher_id,source_class_id,source_course_id,cost_type,source_type,cost_hours,cost_amount_cents,raw_json)
                       values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (source_id) do update set raw_json=excluded.raw_json''',
                    (rid, pick(r,'studentId'), pick(r,'teacherId'), pick(r,'classId'), pick(r,'courseId'), pick(r,'costType'), pick(r,'sourceType'), pick(r,'costHour'), cents(pick(r,'costAmount','amount')), json.dumps(r,ensure_ascii=False)))
        n+=1
    cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','hour_cost_flows',%s,'ok')", (n,))

    # rollcalls xls
    xls = ROOT/'rollcalls_export_student.xls'
    if xls.exists():
        df = pd.read_excel(xls)
        n=0
        for _,row in df.iterrows():
            d={k:(None if pd.isna(v) else v) for k,v in row.to_dict().items()}
            h=hashlib.sha1(json.dumps(d,ensure_ascii=False,sort_keys=True,default=str).encode()).hexdigest()
            cur.execute('''insert into amilyhub.rollcalls(source_row_hash,student_name,class_name,course_name,teacher_name,rollcall_time,class_time_range,status,cost_amount_cents,raw_json)
                           values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (source_row_hash) do nothing''',
                        (h, str(d.get('学员姓名') or d.get('学员') or ''), str(d.get('班级名称') or d.get('班级') or ''), str(d.get('授课课程') or d.get('课程名称') or ''), str(d.get('上课老师') or d.get('老师') or ''), str(d.get('点名时间') or d.get('课消时间') or ''), str(d.get('上课时间') or ''), str(d.get('状态') or ''), cents(d.get('课消金额')), json.dumps(d,ensure_ascii=False,default=str)))
            n+=1
        cur.execute("insert into amilyhub.import_runs(run_key,dataset,rows_loaded,status) values('20260320','rollcalls',%s,'ok')", (n,))

    conn.commit()
    cur.close(); conn.close()
    print('import completed')

if __name__ == '__main__':
    run()
