import argparse
import json
import time
from pathlib import Path
import requests

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'','uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}

DATASETS={
 'hour_cost_flows': {
   'path':'/business/public/studentHourCostFlow/queryPage',
   'payload': lambda p,s: {'checkedDateStart':'2020-01-01','checkedDateEnd':'2030-12-31','current':p,'size':s,'justValid':False,'createdEnd':''}
 },
 'income_expense': {
   'path':'/business/public/instIncomeExpense/queryOnePage',
   'payload': lambda p,s: {'current':p,'size':s,'discardFlag':False,'operationDateStart':'2020-01-01','operationDateEnd':'2030-12-31'}
 },
 'rollcalls': {
   'path':'/business/public/rollCall/queryInstRollCalls',
   'payload': lambda p,s: {'current':p,'size':s,'stateFilter':'NORMAL','rollCallDateStart':'2026-02-18','rollCallDateEnd':'2026-03-20','stateList':['NORMAL']}
 }
}

def post(path,payload,retries=3):
    last=None
    for _ in range(retries):
        try:
            r=requests.post(BASE+path,params=Q,headers=H,json=payload,timeout=30)
            if r.status_code==200:
                return r.json()
            last={'http':r.status_code,'text':r.text[:300]}
        except Exception as e:
            last={'error':str(e)}
        time.sleep(1)
    return {'code':'ERR','message':str(last)}

def extract(resp):
    result=resp.get('result') or {}
    records=result.get('records') or result.get('list') or []
    pages=int(result.get('pages') or 1)
    total=int(result.get('total') or len(records))
    return records,pages,total

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--dataset',required=True,choices=DATASETS.keys())
    ap.add_argument('--outdir',default='exports/raw/export_20260320_130436')
    ap.add_argument('--page-size',type=int,default=100)
    ap.add_argument('--pages-per-run',type=int,default=20)
    ap.add_argument('--reset',action='store_true')
    args=ap.parse_args()

    cfg=DATASETS[args.dataset]
    outdir=Path(args.outdir)
    outdir.mkdir(parents=True,exist_ok=True)
    ckdir=outdir/'checkpoints'
    ckdir.mkdir(parents=True,exist_ok=True)
    ckfile=ckdir/f'{args.dataset}.json'
    datafile=outdir/f'{args.dataset}.jsonl'
    errfile=outdir/f'{args.dataset}.errors.jsonl'

    if args.reset and datafile.exists():
        datafile.unlink()
    if args.reset and ckfile.exists():
        ckfile.unlink()

    if ckfile.exists():
        ck=json.loads(ckfile.read_text())
    else:
        ck={'dataset':args.dataset,'next_page':1,'pages':None,'total':None,'exported_rows':0,'done':False,'updated_at':None}

    if ck.get('done'):
        print(json.dumps({'status':'already_done','checkpoint':ck},ensure_ascii=False))
        return

    # bootstrap first page to discover total pages
    if ck['next_page']==1:
        first=post(cfg['path'],cfg['payload'](1,args.page_size))
        if str(first.get('code'))!='200':
            print(json.dumps({'status':'error','page':1,'resp':first},ensure_ascii=False))
            return
        rows,pages,total=extract(first)
        ck['pages']=pages
        ck['total']=total
        with datafile.open('a',encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r,ensure_ascii=False)+'\n')
        ck['exported_rows'] += len(rows)
        ck['next_page']=2

    start=ck['next_page']
    end=min((start+args.pages_per_run-1), ck['pages'])

    for p in range(start,end+1):
        resp=post(cfg['path'],cfg['payload'](p,args.page_size))
        if str(resp.get('code'))!='200':
            with errfile.open('a',encoding='utf-8') as ef:
                ef.write(json.dumps({'page':p,'resp':resp},ensure_ascii=False)+'\n')
            continue
        rows,_,_=extract(resp)
        with datafile.open('a',encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r,ensure_ascii=False)+'\n')
        ck['exported_rows'] += len(rows)
        ck['next_page']=p+1

    if ck['next_page']>ck['pages']:
        ck['done']=True

    ck['updated_at']=time.strftime('%Y-%m-%d %H:%M:%S')
    ckfile.write_text(json.dumps(ck,ensure_ascii=False,indent=2))

    print(json.dumps({
        'status':'ok',
        'dataset':args.dataset,
        'processed_pages':f'{start}-{end}',
        'next_page':ck['next_page'],
        'pages':ck['pages'],
        'exported_rows':ck['exported_rows'],
        'done':ck['done'],
        'checkpoint':str(ckfile)
    },ensure_ascii=False))

if __name__=='__main__':
    main()
