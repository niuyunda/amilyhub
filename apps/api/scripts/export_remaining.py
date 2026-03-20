import json, time
from pathlib import Path
import requests

BASE = 'https://gateway.xiaomai5.com'
QUERY = {
    'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a',
    'uid':'1219458615660421122','tid':'','aid':'1288326120321376258'
}
HEADERS = {
    'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01',
    'originPath':'https://b.xiaomai5.com/#/course_consumption_record','userId':'1219458615660421122','xmrule':'latest',
    'userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'',
    'uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a',
    'vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'
}

def post(path, payload):
    r = requests.post(BASE+path, params=QUERY, headers=HEADERS, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()

def extract_records(resp):
    result = resp.get('result')
    if isinstance(result, dict):
        for k in ('records','list','dataList','items','rows'):
            if isinstance(result.get(k), list):
                return result[k], int(result.get('pages') or 1), int(result.get('total') or len(result[k]))
    return [],1,0

outdir = Path('exports/raw/export_20260320_130436')

# Export hour_cost_flows
print('Exporting hour_cost_flows...')
path = '/business/public/studentHourCostFlow/queryPage'
page, size = 1, 100
all_rows = []
first = post(path, {'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':page,'size':size,'justValid':False,'createdEnd':''})
if str(first.get('code')) == '200':
    rows, pages, total = extract_records(first)
    all_rows.extend(rows)
    for page in range(2, pages+1):
        resp = post(path, {'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':page,'size':size,'justValid':False,'createdEnd':''})
        if str(resp.get('code')) == '200':
            r, _, _ = extract_records(resp)
            all_rows.extend(r)
    with (outdir/'hour_cost_flows.jsonl').open('w', encoding='utf-8') as f:
        for row in all_rows:
            f.write(json.dumps(row, ensure_ascii=False)+'\n')
    print(f'hour_cost_flows: {len(all_rows)} rows')
else:
    print(f'hour_cost_flows error: {first}')

# Export income_expense
print('Exporting income_expense...')
path = '/business/public/instIncomeExpense/queryOnePage'
page, size = 1, 100
all_rows = []
first = post(path, {'current':page,'size':size,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'})
if str(first.get('code')) == '200':
    rows, pages, total = extract_records(first)
    all_rows.extend(rows)
    for page in range(2, pages+1):
        resp = post(path, {'current':page,'size':size,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'})
        if str(resp.get('code')) == '200':
            r, _, _ = extract_records(resp)
            all_rows.extend(r)
    with (outdir/'income_expense.jsonl').open('w', encoding='utf-8') as f:
        for row in all_rows:
            f.write(json.dumps(row, ensure_ascii=False)+'\n')
    print(f'income_expense: {len(all_rows)} rows')
else:
    print(f'income_expense error: {first}')

print('Done!')
