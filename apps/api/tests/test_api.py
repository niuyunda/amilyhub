import pathlib
import sys
import uuid

from fastapi.testclient import TestClient

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
from app.api import app


client = TestClient(app)


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def test_health_ok():
    r = client.get('/api/v1/health')
    assert r.status_code == 200
    data = r.json()
    assert data['ok'] is True


def test_dashboard_summary_has_extended_fields():
    r = client.get('/api/v1/dashboard/summary')
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    for k in [
        'students', 'active_students', 'teachers', 'orders', 'hour_cost_flows',
        'rollcalls', 'income_expense', 'income_cents', 'expense_cents',
        'net_income_cents', 'receivable_cents', 'received_cents', 'arrears_cents'
    ]:
        assert k in payload['data']


def test_students_pagination_model():
    r = client.get('/api/v1/students', params={'page': 1, 'page_size': 5})
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    assert 'data' in payload and isinstance(payload['data'], list)
    assert payload['page']['page'] == 1
    assert payload['page']['page_size'] == 5


def test_student_put_partial_update_success():
    sid = _uid('stu')
    create = client.post('/api/v1/students', json={
        'source_student_id': sid,
        'name': 'P0 Student',
        'phone': '13800138000',
        'gender': 'F',
        'status': 'active'
    })
    assert create.status_code == 201, create.text
    assert create.json()['data']['source_student_id'] == sid

    update = client.put(f'/api/v1/students/{sid}', json={
        'phone': '13900139000'
    })
    assert update.status_code == 200, update.text
    payload = update.json()['data']
    assert payload['name'] == 'P0 Student'
    assert payload['phone'] == '13900139000'


def test_student_not_found_error_model():
    r = client.get('/api/v1/students/not_exist_123')
    assert r.status_code == 404
    payload = r.json()
    assert payload['ok'] is False
    assert payload['error']['code'] == 'STUDENT_NOT_FOUND'


def test_order_create_requires_valid_student():
    oid = _uid('ord')
    r = client.post('/api/v1/orders', json={
        'source_order_id': oid,
        'source_student_id': 'student_not_exist',
        'order_type': '课时包',
        'order_state': 'paid',
        'receivable_cents': 10000,
        'received_cents': 10000,
        'arrears_cents': 0,
    })
    assert r.status_code == 422
    payload = r.json()
    assert payload['error']['code'] == 'STUDENT_NOT_FOUND'


def test_order_put_partial_update_success():
    sid = _uid('stu')
    create_student = client.post('/api/v1/students', json={
        'source_student_id': sid,
        'name': 'Order Student',
        'status': 'active'
    })
    assert create_student.status_code == 201, create_student.text

    oid = _uid('ord')
    create = client.post('/api/v1/orders', json={
        'source_order_id': oid,
        'source_student_id': sid,
        'order_type': '课时包',
        'order_state': 'paid',
        'receivable_cents': 20000,
        'received_cents': 20000,
        'arrears_cents': 0,
    })
    assert create.status_code == 201, create.text

    update = client.put(f'/api/v1/orders/{oid}', json={
        'order_state': 'partial',
        'received_cents': 18000,
        'arrears_cents': 2000,
    })
    assert update.status_code == 200, update.text
    payload = update.json()['data']
    assert payload['order_type'] == '课时包'
    assert payload['order_state'] == 'partial'
    assert payload['received_cents'] == 18000


def test_hour_cost_flows_filter_and_shape():
    r = client.get('/api/v1/hour-cost-flows', params={'page': 1, 'page_size': 3})
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    assert isinstance(payload['data'], list)


def test_income_expense_summary_shape():
    r = client.get('/api/v1/income-expense/summary')
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    for k in ['total_count', 'income_cents', 'expense_cents', 'net_income_cents']:
        assert k in payload['data']


def test_rollcalls_filter_works():
    r = client.get('/api/v1/rollcalls', params={'q': 'test', 'page': 1, 'page_size': 2})
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    assert 'page' in payload


def test_integrity_endpoint():
    r = client.get('/api/v1/data/integrity')
    assert r.status_code == 200
    payload = r.json()
    assert payload['ok'] is True
    assert 'issues' in payload['data']


def test_order_renewal_and_order_list_student_name():
    sid = _uid('stu')
    student_name = f'Renew Student {sid}'
    phone = f'139{sid[-8:]}'
    create_student = client.post('/api/v1/students', json={
        'source_student_id': sid,
        'name': student_name,
        'phone': phone,
        'status': 'active'
    })
    assert create_student.status_code == 201, create_student.text

    renewal = client.post('/api/v1/orders/renewal', json={
        'source_student_id': sid,
        'receivable_cents': 10000,
        'received_cents': 8000,
        'arrears_cents': 2000,
    })
    assert renewal.status_code == 201, renewal.text
    source_order_id = renewal.json()['data']['source_order_id']

    listed = client.get('/api/v1/orders', params={'student_id': sid, 'page': 1, 'page_size': 20})
    assert listed.status_code == 200
    hit = [x for x in listed.json()['data'] if x['source_order_id'] == source_order_id][0]
    assert hit['student_name'] == student_name


def test_schedule_events_create_and_conflict():
    teacher_name = f'Teacher {_uid("t")}'
    ok_create = client.post('/api/v1/schedule-events', json={
        'class_name': 'P0 班课A',
        'teacher_name': teacher_name,
        'start_time': '2026-03-22T09:00:00+13:00',
        'end_time': '2026-03-22T10:00:00+13:00',
        'room_name': 'R1'
    })
    assert ok_create.status_code == 201, ok_create.text

    conflict = client.post('/api/v1/schedule-events', json={
        'class_name': 'P0 班课B',
        'teacher_name': teacher_name,
        'start_time': '2026-03-22T09:30:00+13:00',
        'end_time': '2026-03-22T10:30:00+13:00',
        'room_name': 'R2'
    })
    assert conflict.status_code == 409
    assert conflict.json()['error']['code'] == 'SCHEDULE_CONFLICT'


def test_rollcall_confirm_is_idempotent():
    source_id = _uid('rc')
    student_name = f'点名学生A_{source_id[-4:]}'
    create_rollcall = client.post('/api/v1/students', json={
        'source_student_id': _uid('stu'),
        'name': student_name,
        'phone': f'138{source_id[-8:]}',
        'status': 'active'
    })
    assert create_rollcall.status_code == 201

    from app.db import get_conn
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into amilyhub.rollcalls(source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_amount_cents, raw_json)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                on conflict (source_row_hash) do nothing
                """,
                (source_id, student_name, 'P0班', '英语', 'Teacher P0', '2026-03-22 09:00', '2026-03-22 09:00-10:00', '正常', 0, '{}'),
            )
            conn.commit()

    c1 = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '正常'})
    c2 = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '正常'})
    assert c1.status_code == 200
    assert c2.status_code == 200
    assert c1.json()['data']['idempotent_key'] == c2.json()['data']['idempotent_key']


def test_order_void_and_refund_event_logging():
    sid = _uid('stu')
    s = client.post('/api/v1/students', json={
        'source_student_id': sid,
        'name': f'Order Action Student {sid}',
        'phone': f'137{sid[-8:]}',
        'status': 'active'
    })
    assert s.status_code == 201, s.text

    oid = _uid('ord')
    create = client.post('/api/v1/orders', json={
        'source_order_id': oid,
        'source_student_id': sid,
        'order_type': '课时包',
        'order_state': '已支付',
        'receivable_cents': 15000,
        'received_cents': 15000,
        'arrears_cents': 0,
    })
    assert create.status_code == 201, create.text

    v1 = client.post(f'/api/v1/orders/{oid}/void', json={'operator': 'qa_user', 'reason': 'dup_order'})
    v2 = client.post(f'/api/v1/orders/{oid}/void', json={'operator': 'qa_user', 'reason': 'dup_order'})
    assert v1.status_code == 200, v1.text
    assert v2.status_code == 200, v2.text
    assert v1.json()['data']['order_state'] == '已作废'

    r1 = client.post(f'/api/v1/orders/{oid}/refund', json={'operator': 'qa_user', 'reason': 'user_cancel'})
    r2 = client.post(f'/api/v1/orders/{oid}/refund', json={'operator': 'qa_user', 'reason': 'user_cancel'})
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r1.json()['data']['order_type'] == '退费'
    assert r1.json()['data']['order_state'] == '已作废'

    from app.db import fetch_one
    void_event = fetch_one(
        """
        select count(*)::int as c
        from amilyhub.order_events
        where source_order_id=%s and event_type='void'
        """,
        (oid,),
    )
    refund_event = fetch_one(
        """
        select count(*)::int as c
        from amilyhub.order_events
        where source_order_id=%s and event_type='refund'
        """,
        (oid,),
    )
    payload_check = fetch_one(
        """
        select order_id, operator, reason, payload->>'reason' as payload_reason
        from amilyhub.order_events
        where source_order_id=%s and event_type='refund'
        order by id desc
        limit 1
        """,
        (oid,),
    )
    assert void_event['c'] == 1
    assert refund_event['c'] == 1
    assert payload_check['order_id'] == oid
    assert payload_check['operator'] == 'qa_user'
    assert payload_check['reason'] == 'user_cancel'
    assert payload_check['payload_reason'] == 'user_cancel'


def test_rollcall_confirm_leave_absent_revoke_are_consistent():
    source_id = _uid('rc')
    student_id = _uid('stu')
    student_name = f'点名学生B_{source_id[-4:]}'
    create_student = client.post('/api/v1/students', json={
        'source_student_id': student_id,
        'name': student_name,
        'phone': f'136{source_id[-8:]}',
        'status': 'active'
    })
    assert create_student.status_code == 201, create_student.text

    from app.db import fetch_one, get_conn
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into amilyhub.rollcalls(source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_amount_cents, raw_json)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                on conflict (source_row_hash) do nothing
                """,
                (source_id, student_name, 'P0班B', '英语', 'Teacher P1', '2026-03-22 11:00', '2026-03-22 11:00-12:00', '正常', 0, '{}'),
            )
            conn.commit()

    leave_confirm = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '请假', 'operator': 'qa_user'})
    assert leave_confirm.status_code == 200, leave_confirm.text
    assert leave_confirm.json()['data']['status'] == '请假'

    flow_source_id = f'ROLLCALL_{source_id}'
    leave_flow = fetch_one("select cost_hours, cost_type from amilyhub.hour_cost_flows where source_id=%s", (flow_source_id,))
    assert float(leave_flow['cost_hours']) == 0
    assert leave_flow['cost_type'] == '请假'

    absent_confirm = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '旷课', 'reason': 'no_show'})
    assert absent_confirm.status_code == 200, absent_confirm.text
    assert absent_confirm.json()['data']['status'] == '旷课'

    absent_flow = fetch_one("select cost_hours, cost_type from amilyhub.hour_cost_flows where source_id=%s", (flow_source_id,))
    assert float(absent_flow['cost_hours']) == 1
    assert absent_flow['cost_type'] == '旷课课消'

    revoke_1 = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '撤销确认'})
    revoke_2 = client.post(f'/api/v1/rollcalls/{source_id}/confirm', json={'status': '撤销确认'})
    assert revoke_1.status_code == 200, revoke_1.text
    assert revoke_2.status_code == 200, revoke_2.text
    assert revoke_1.json()['data']['idempotent_key'] == revoke_2.json()['data']['idempotent_key']
    assert revoke_1.json()['data']['revoked'] is True
    assert revoke_2.json()['data']['revoked'] is False

    flow_after_revoke = fetch_one("select source_id from amilyhub.hour_cost_flows where source_id=%s", (flow_source_id,))
    assert flow_after_revoke is None
