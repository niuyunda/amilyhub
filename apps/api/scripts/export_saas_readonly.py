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
    'originPath':'https://b.xiaomai5.com/#/order_manage/order_list','userId':'1219458615660421122','xmrule':'latest',
    'userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'',
    'uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a',
    'vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'
}

DATASETS = [
    {
        'name':'teachers',
        'path':'/business/public/teacher/getTeacherBuffPage',
        'body': lambda p,s: {'current':p,'size':s}
    },
    {
        'name':'students_learning',
        'path':'/business/public/student/getLearningStudentPageCheckPermission',
        'body': lambda p,s: {
            'queryText':'','current':p,'size':s,'status':3,
            'filterRequest':{},'basicRequest':{},'expandRequest':{},'timeRangeRequest':{},'tagAndAttrRequest':{},
            'filterByAccountAndTeacher':False
        }
    },
    {
        'name':'orders',
        'path':'/business/public/order/searchPage',
        'body': lambda p,s: {
            'bizAccountId':'1288326120321376258','size':s,'current':p,
            'businessStates':['ARREARS','PAID','WAITING','REFUND_FAILED','REFUNDING'],
            'businessTypes':[],'businessOwnerIds':[],'sortType':'ID_DESC',
            'createdStart':'','createdEnd':'','businessNo':'','isStudentEntrance':False
        }
    },
    {
        'name':'rollcalls',
        'path':'/business/public/rollCall/queryInstRollCalls',
        'body': lambda p,s: {
            'current':p,'size':s,'stateFilter':'NORMAL','rollCallDateStart':'2020-01-01','rollCallDateEnd':'2030-12-31','stateList':['NORMAL']
        }
    },
    {
        'name':'hour_cost_flows',
        'path':'/business/public/studentHourCostFlow/queryPage',
        'body': lambda p,s: {
            'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':p,'size':s,'justValid':False,'createdEnd':''
        }
    },
    {
        'name':'income_expense',
        'path':'/business/public/instIncomeExpense/queryOnePage',
        'body': lambda p,s: {
            'current':p,'size':s,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'
        }
    },
]

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

def run():
    ts = time.strftime('%Y%m%d_%H%M%S')
    outdir = Path('exports/raw') / f'export_{ts}'
    outdir.mkdir(parents=True, exist_ok=True)
    summary = {}
    for ds in DATASETS:
        name=ds['name']
        page=1
        size=100
        all_rows=[]
        errors=[]
        first = post(ds['path'], ds['body'](page,size))
        if str(first.get('code')) != '200':
            errors.append(first)
            summary[name]={'ok':False,'error':first.get('message','unknown')}
            (outdir/f'{name}.error.json').write_text(json.dumps(first,ensure_ascii=False,indent=2))
            continue
        rows,pages,total = extract_records(first)
        all_rows.extend(rows)
        for page in range(2,pages+1):
            try:
                resp=post(ds['path'], ds['body'](page,size))
                if str(resp.get('code'))!='200':
                    errors.append({'page':page,'resp':resp})
                    continue
                r,_,_ = extract_records(resp)
                all_rows.extend(r)
            except Exception as e:
                errors.append({'page':page,'error':str(e)})
        with (outdir/f'{name}.jsonl').open('w',encoding='utf-8') as f:
            for row in all_rows:
                f.write(json.dumps(row,ensure_ascii=False)+'\n')
        summary[name]={'ok':True,'rows':len(all_rows),'reported_total':total,'pages':pages,'errors':len(errors)}
        if errors:
            (outdir/f'{name}.errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    (outdir/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(outdir)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    run()
