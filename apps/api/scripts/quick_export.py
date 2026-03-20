import json, requests

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'','uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}

def fetch(path, payload):
    r=requests.post(BASE+path,params=Q,headers=H,json=payload,timeout=30)
    return r.json()

outdir='exports/raw/export_20260320_130436'

# hour_cost_flows
print('Fetching hour_cost_flows page 1...')
resp=fetch('/business/public/studentHourCostFlow/queryPage',{'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':1,'size':100,'justValid':False,'createdEnd':''})
print('code:', resp.get('code'))
if str(resp.get('code'))=='200':
    result=resp.get('result',{})
    records=result.get('records',[])
    total=int(result.get('total',0))
    pages=int(result.get('pages',1))
    print(f'Page 1: {len(records)} records, total {total}, pages {pages}')
    all_rows=list(records)
    for p in range(2, pages+1):
        print(f'Fetching hour_cost_flows page {p}/{pages}...')
        resp=fetch('/business/public/studentHourCostFlow/queryPage',{'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':p,'size':100,'justValid':False,'createdEnd':''})
        if str(resp.get('code'))=='200':
            all_rows.extend(resp.get('result',{}).get('records',[]))
        else:
            print(f'  Error on page {p}')
    with open(f'{outdir}/hour_cost_flows.jsonl','w') as f:
        for r in all_rows:
            f.write(json.dumps(r,ensure_ascii=False)+'\n')
    print(f'hour_cost_flows: {len(all_rows)} rows exported')
else:
    print(f'Error: {resp}')

# income_expense
print('Fetching income_expense page 1...')
resp=fetch('/business/public/instIncomeExpense/queryOnePage',{'current':1,'size':100,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'})
print('code:', resp.get('code'))
if str(resp.get('code'))=='200':
    result=resp.get('result',{})
    records=result.get('records',[])
    total=int(result.get('total',0))
    pages=int(result.get('pages',1))
    print(f'Page 1: {len(records)} records, total {total}, pages {pages}')
    all_rows=list(records)
    for p in range(2, pages+1):
        print(f'Fetching income_expense page {p}/{pages}...')
        resp=fetch('/business/public/instIncomeExpense/queryOnePage',{'current':p,'size':100,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'})
        if str(resp.get('code'))=='200':
            all_rows.extend(resp.get('result',{}).get('records',[]))
        else:
            print(f'  Error on page {p}')
    with open(f'{outdir}/income_expense.jsonl','w') as f:
        for r in all_rows:
            f.write(json.dumps(r,ensure_ascii=False)+'\n')
    print(f'income_expense: {len(all_rows)} rows exported')
else:
    print(f'Error: {resp}')

print('All done!')
