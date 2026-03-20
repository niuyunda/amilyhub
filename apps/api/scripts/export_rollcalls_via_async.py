import json, time
from pathlib import Path
import requests

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','originPath':'https://b.xiaomai5.com/#/class_record/take_name_record','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','cid':'','orgAdminId':'','uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}

outdir=Path('exports/raw/export_20260320_130436')
outdir.mkdir(parents=True,exist_ok=True)

# Same payload observed from browser export click
payload={
    'current':1,
    'size':10,
    'stateFilter':'1',
    'rollCallDateStart':1771326000000,
    'rollCallDateEnd':1774004399999
}

r=requests.post(BASE+'/business/public/rollCall/exportClassStudentRollCallAsync',params=Q,headers=H,json=payload,timeout=30)
resp=r.json()
if str(resp.get('code'))!='200':
    print('export trigger failed',resp)
    raise SystemExit(1)

result=resp['result']
export_id=result['id']
resource_id=result['resourceId']
print('export_id',export_id,'resource_id',resource_id)

# poll READY
for i in range(15):
    rr=requests.post(BASE+'/business/public/export/getById',params=Q,headers=H,json={'id':export_id},timeout=30).json()
    state=(rr.get('result') or {}).get('state')
    print('poll',i,'state',state)
    if state=='READY':
        break
    time.sleep(1)

res=requests.post(BASE+'/business/public/studentClassHour/getResource',params=Q,headers=H,json={'resourceId':resource_id},timeout=30).json()
if str(res.get('code'))!='200':
    print('getResource failed',res)
    raise SystemExit(2)
url=res['result']

# download file
fn=outdir/'rollcalls_export_student.xls'
with requests.get(url,timeout=60) as dr:
    dr.raise_for_status()
    fn.write_bytes(dr.content)

meta={
    'exportId':export_id,
    'resourceId':resource_id,
    'downloadUrl':url,
    'file':str(fn),
    'sizeBytes':fn.stat().st_size
}
(outdir/'rollcalls_export_student.meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps(meta,ensure_ascii=False,indent=2))
