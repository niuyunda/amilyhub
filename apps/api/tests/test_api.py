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


def test_student_create_and_update():
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
        'source_student_id': sid,
        'name': 'P0 Student Updated',
        'phone': '13900139000',
        'gender': 'F',
        'status': 'active'
    })
    assert update.status_code == 200, update.text
    assert update.json()['data']['name'] == 'P0 Student Updated'


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


def test_order_create_and_update_success():
    sid = _uid('stu')
    client.post('/api/v1/students', json={
        'source_student_id': sid,
        'name': 'Order Student',
        'status': 'active'
    })

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
        'source_order_id': oid,
        'source_student_id': sid,
        'order_type': '课时包',
        'order_state': 'partial',
        'receivable_cents': 20000,
        'received_cents': 18000,
        'arrears_cents': 2000,
    })
    assert update.status_code == 200
    assert update.json()['data']['order_state'] == 'partial'


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
