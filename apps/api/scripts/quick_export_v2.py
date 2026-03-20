import json, requests, time

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'','uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}

def fetch(path, payload):
    for i in range(3):
        try:
            r=requests.post(BASE+path,params=Q,headers=H,json=payload,timeout=30)
            if r.status_code == 200: return r.json()
        except: time.sleep(1)
    return None

outdir='exports/raw/export_20260320_130436'

def do_export(name, path, base_payload):
    print(f'Starting {name}...')
    first = fetch(path, {**base_payload, 'current':1, 'size':100})
    if not first or str(first.get('code')) != '200':
        print(f'Error starting {name}: {first}')
        return
    
    res = first.get('result', {})
    total = int(res.get('total', 0))
    pages = int(res.get('pages', 1))
    print(f'{name}: total {total}, pages {pages}')
    
    with open(f'{outdir}/{name}.jsonl', 'w', encoding='utf-8') as f:
        for r in res.get('records', []):
            f.write(json.dumps(r, ensure_ascii=False)+'\n')
        
        for p in range(2, pages + 1):
            if p % 10 == 0: print(f'  {name} page {p}/{pages}...')
            resp = fetch(path, {**base_payload, 'current':p, 'size':100})
            if resp and str(resp.get('code')) == '200':
                for r in resp.get('result', {}).get('records', []):
                    f.write(json.dumps(r, ensure_ascii=False)+'\n')
            else:
                print(f'  Error {name} page {p}')
            time.sleep(0.1)

# Skip hour_cost_flows if it's too big/slow for a single turn, or just do it.
# Actually 437 pages * 0.1s + latency is about 2-3 mins.
do_export('hour_cost_flows', '/business/public/studentHourCostFlow/queryPage', {'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','justValid':False,'createdEnd':''})
do_export('income_expense', '/business/public/instIncomeExpense/queryOnePage', {'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'})
do_export('rollcalls_retry', '/business/public/rollCall/queryInstRollCalls', {'stateFilter':'NORMAL','rollCallDateStart':'2020-01-01','rollCallDateEnd':'2030-12-31','stateList':['NORMAL']})

print('All completed!')
