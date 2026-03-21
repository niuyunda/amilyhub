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
    }, headers={"x-role": "admin", "x-operator": "qa_admin"})
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
    }, headers={"x-role": "admin", "x-operator": "qa_admin"})
    assert ok_create.status_code == 201, ok_create.text

    conflict = client.post('/api/v1/schedule-events', json={
        'class_name': 'P0 班课B',
        'teacher_name': teacher_name,
        'start_time': '2026-03-22T09:30:00+13:00',
        'end_time': '2026-03-22T10:30:00+13:00',
        'room_name': 'R2'
    }, headers={"x-role": "admin", "x-operator": "qa_admin"})
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

    headers = {"x-role": "admin", "x-operator": "qa_user"}
    v1 = client.post(f'/api/v1/orders/{oid}/void', json={'operator': 'qa_user', 'reason': 'dup_order'}, headers=headers)
    v2 = client.post(f'/api/v1/orders/{oid}/void', json={'operator': 'qa_user', 'reason': 'dup_order'}, headers=headers)
    assert v1.status_code == 200, v1.text
    assert v2.status_code == 200, v2.text
    assert v1.json()['data']['order_state'] == '已作废'

    r1 = client.post(f'/api/v1/orders/{oid}/refund', json={'operator': 'qa_user', 'reason': 'user_cancel'}, headers=headers)
    r2 = client.post(f'/api/v1/orders/{oid}/refund', json={'operator': 'qa_user', 'reason': 'user_cancel'}, headers=headers)
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


def test_teacher_crud_and_status_happy_path():
    tid = _uid('tch')
    name = f'Teacher CRUD {tid}'
    headers = {"x-role": "admin", "x-operator": "qa_admin"}
    create = client.post('/api/v1/teachers', json={
        'source_teacher_id': tid,
        'name': name,
        'phone': '13800138011',
        'subjects': ['英语'],
        'status': '在职',
    }, headers=headers)
    assert create.status_code == 201, create.text
    assert create.json()['data']['source_teacher_id'] == tid
    assert create.json()['data']['status'] == '在职'

    update = client.put(f'/api/v1/teachers/{tid}', json={
        'phone': '13800138022',
        'subjects': ['英语', '数学'],
    }, headers=headers)
    assert update.status_code == 200, update.text
    assert update.json()['data']['phone'] == '13800138022'
    assert update.json()['data']['subjects'] == ['英语', '数学']

    disable = client.patch(f'/api/v1/teachers/{tid}/status', json={'status': '停用'}, headers=headers)
    assert disable.status_code == 200, disable.text
    assert disable.json()['data']['status'] == '停用'

    listed = client.get('/api/v1/teachers', params={'q': tid, 'status': '停用', 'page': 1, 'page_size': 10})
    assert listed.status_code == 200, listed.text
    rows = listed.json()['data']
    hit = [x for x in rows if x['source_teacher_id'] == tid]
    assert hit and hit[0]['status'] == '停用'


def test_teacher_duplicate_and_missing_status_update():
    tid = _uid('tch')
    headers = {"x-role": "admin", "x-operator": "qa_admin"}
    first = client.post('/api/v1/teachers', json={
        'source_teacher_id': tid,
        'name': f'Teacher Dup {tid}',
        'subjects': ['语文'],
        'status': '在职',
    }, headers=headers)
    assert first.status_code == 201, first.text

    duplicate = client.post('/api/v1/teachers', json={
        'source_teacher_id': tid,
        'name': f'Teacher Dup2 {tid}',
        'subjects': ['语文'],
        'status': '在职',
    }, headers=headers)
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()['error']['code'] == 'TEACHER_EXISTS'

    missing = client.patch(f'/api/v1/teachers/{_uid("tch_missing")}/status', json={'status': '停用'}, headers=headers)
    assert missing.status_code == 404, missing.text
    assert missing.json()['error']['code'] == 'TEACHER_NOT_FOUND'


def test_income_expense_write_and_void_happy_path():
    rid = _uid('fin')
    headers = {"x-role": "admin", "x-operator": "finance_admin"}
    create = client.post('/api/v1/income-expense', json={
        'source_record_id': rid,
        'item_type': '学费',
        'direction': '收入',
        'amount_cents': 12345,
        'operation_date': '2026-03-22',
        'payment_method': '微信',
        'operator': '财务A',
        'remark': '首笔录入',
        'status': '正常',
    }, headers=headers)
    assert create.status_code == 201, create.text
    assert create.json()['data']['source_record_id'] == rid
    assert create.json()['data']['status'] == '正常'

    update = client.put(f'/api/v1/income-expense/{rid}', json={
        'amount_cents': 13000,
        'payment_method': '转账',
        'remark': '更新备注',
    }, headers=headers)
    assert update.status_code == 200, update.text
    assert update.json()['data']['amount_cents'] == 13000
    assert update.json()['data']['payment_method'] == '转账'

    voided = client.post(f'/api/v1/income-expense/{rid}/void', json={'operator': '财务B', 'reason': '录入错误'}, headers=headers)
    assert voided.status_code == 200, voided.text
    assert voided.json()['data']['status'] == '作废'

    listed = client.get('/api/v1/income-expense', params={'q': rid, 'page': 1, 'page_size': 10})
    assert listed.status_code == 200, listed.text
    rows = listed.json()['data']
    hit = [x for x in rows if x['source_id'] == rid]
    assert hit and hit[0]['status'] == '作废'


def test_income_expense_invalid_direction_and_void_not_found():
    invalid = client.post('/api/v1/income-expense', json={
        'item_type': '采购',
        'direction': 'UNKNOWN',
        'amount_cents': 100,
        'operation_date': '2026-03-22',
    }, headers={"x-role": "admin", "x-operator": "finance_admin"})
    assert invalid.status_code == 422, invalid.text
    assert invalid.json()['error']['code'] == 'INVALID_DIRECTION'

    missing = client.post(f'/api/v1/income-expense/{_uid("fin_missing")}/void', json={'reason': 'x'}, headers={"x-role": "admin", "x-operator": "finance_admin"})
    assert missing.status_code == 404, missing.text
    assert missing.json()['error']['code'] == 'INCOME_EXPENSE_NOT_FOUND'


def test_rbac_forbidden_and_audit_log_written():
    tid = _uid('tch_rbac')
    deny = client.post('/api/v1/teachers', json={
        'source_teacher_id': tid,
        'name': 'RBAC Deny Teacher',
        'status': '在职',
    }, headers={"x-role": "staff", "x-operator": "staff_user"})
    assert deny.status_code == 403, deny.text
    deny_payload = deny.json()
    assert deny_payload['error']['code'] == 'FORBIDDEN'
    assert deny_payload['error']['message'] == '无权限执行该操作'

    allow_id = _uid('tch_rbac_ok')
    allow = client.post('/api/v1/teachers', json={
        'source_teacher_id': allow_id,
        'name': 'RBAC Allow Teacher',
        'status': '在职',
    }, headers={"x-role": "admin", "x-operator": "admin_user"})
    assert allow.status_code == 201, allow.text

    from app.db import fetch_one
    audit = fetch_one(
        """
        select operator, role, action, resource_type, resource_id
        from amilyhub.audit_logs
        where action='teachers.create' and resource_id=%s
        order by id desc
        limit 1
        """,
        (allow_id,),
    )
    assert audit is not None
    assert audit['operator'] == 'admin_user'
    assert audit['role'] == 'admin'
    assert audit['resource_type'] == 'teacher'


def test_rbac_role_update_success_and_reject_invalid_permission_and_forbidden():
    role_name = f"manager_{uuid.uuid4().hex[:8]}"
    ok_resp = client.put(
        f"/api/v1/rbac/roles/{role_name}",
        json={"permissions": ["orders:write", "audit:read"]},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert ok_resp.status_code == 200, ok_resp.text
    assert ok_resp.json()["data"]["role"] == role_name
    assert set(ok_resp.json()["data"]["permissions"]) == {"orders:write", "audit:read"}

    forbidden = client.put(
        f"/api/v1/rbac/roles/{role_name}",
        json={"permissions": ["orders:write"]},
        headers={"x-role": "manager", "x-operator": "rbac_manager"},
    )
    assert forbidden.status_code == 403, forbidden.text
    assert forbidden.json()["error"]["code"] == "FORBIDDEN"

    invalid = client.put(
        f"/api/v1/rbac/roles/{role_name}",
        json={"permissions": ["orders:write", "unknown:permission"]},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert invalid.status_code == 422, invalid.text
    assert invalid.json()["error"]["code"] == "INVALID_PERMISSION"


def test_audit_logs_query_filter_by_operator():
    rid = _uid("fin_audit")
    operator = "audit_filter_user"
    create = client.post(
        "/api/v1/income-expense",
        json={
            "source_record_id": rid,
            "item_type": "课时费",
            "direction": "收入",
            "amount_cents": 999,
            "operation_date": "2026-03-22",
            "payment_method": "微信",
            "operator": "财务",
            "remark": "audit filter",
            "status": "正常",
        },
        headers={"x-role": "admin", "x-operator": operator},
    )
    assert create.status_code == 201, create.text

    query_resp = client.get(
        "/api/v1/audit-logs",
        params={"operator": operator, "limit": 20},
        headers={"x-role": "manager", "x-operator": "manager_query"},
    )
    assert query_resp.status_code == 200, query_resp.text
    rows = query_resp.json()["data"]
    assert any(row.get("operator") == operator for row in rows)


def test_rbac_role_update_writes_before_after_diff_payload():
    role_name = f"audited_role_{uuid.uuid4().hex[:8]}"
    initial = client.put(
        f"/api/v1/rbac/roles/{role_name}",
        json={"permissions": ["orders:write"]},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert initial.status_code == 200, initial.text

    update = client.put(
        f"/api/v1/rbac/roles/{role_name}",
        json={"permissions": ["orders:write", "audit:read"]},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert update.status_code == 200, update.text

    audit = client.get(
        "/api/v1/audit-logs",
        params={"action": "rbac.role_permissions.update", "limit": 20},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert audit.status_code == 200, audit.text
    rows = audit.json()["data"]
    target = next((x for x in rows if x.get("resource_id") == role_name), None)
    assert target is not None
    payload = target.get("payload") or {}
    assert payload.get("before") == ["orders:write"]
    assert payload.get("after") == ["audit:read", "orders:write"]
    assert payload.get("diff", {}).get("added") == ["audit:read"]
    assert payload.get("diff", {}).get("removed") == []


def test_audit_logs_export_csv_returns_header_and_content():
    rid = _uid("fin_csv")
    operator = "audit_csv_user"
    create = client.post(
        "/api/v1/income-expense",
        json={
            "source_record_id": rid,
            "item_type": "课时费",
            "direction": "收入",
            "amount_cents": 888,
            "operation_date": "2026-03-22",
            "payment_method": "微信",
            "operator": "财务",
            "remark": "audit csv",
            "status": "正常",
        },
        headers={"x-role": "admin", "x-operator": operator},
    )
    assert create.status_code == 201, create.text

    resp = client.get(
        "/api/v1/audit-logs/export.csv",
        params={"operator": operator, "limit": 20},
        headers={"x-role": "admin", "x-operator": "rbac_admin"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=\"audit-logs.csv\"" in resp.headers.get("content-disposition", "")

    lines = [line for line in resp.text.strip().splitlines() if line]
    assert len(lines) >= 2
    assert lines[0] == "created_at,operator,role,action,resource_type,resource_id"
    assert any(operator in line for line in lines[1:])
