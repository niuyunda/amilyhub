import json
import pathlib
import sys
import requests

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
from app.api import ensure_courses_table
from app.db import get_conn

BASE='https://gateway.xiaomai5.com'
Q={'p':'w','v':'v5.4.8','userType':'B','token':'193efb197c8642ea84b91dac8dc21b0e','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
H={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','originPath':'https://b.xiaomai5.com/#/course_fees_manage/course_manage','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w','bizAccountId':'1288326120321376258','uid':'1219458615660421122','tid':'','token':'193efb197c8642ea84b91dac8dc21b0e','xmToken':'193efb197c8642ea84b91dac8dc21b0e','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'}

def map_type(t,name):
    if t=='ONE2ONE' or '一对一' in (name or '') or '1V1' in (name or '').upper():
        return '一对一'
    return '一对多'

def map_status(s):
    return '启用' if s=='ON' else '停用'

def pricing_items(course_price_vo):
    out=[]
    for rule in course_price_vo or []:
        for p in rule.get('priceListVOS') or []:
            n=p.get('priceName') or '单价'
            price=float(p.get('price') or 0)
            q=float(p.get('quantity') or 1)
            total=float(p.get('totalPrice') or price)
            out.append({'name': n, 'quantity': q, 'totalPrice': total, 'price': price})
    return out[:10]


def pricing_lines(items):
    out=[]
    for p in items:
        n=p.get('name') or '单价'
        price=float(p.get('price') or 0)
        q=float(p.get('quantity') or 1)
        total=float(p.get('totalPrice') or price)
        if q and q!=1:
            out.append(f"{n}({int(total) if total==int(total) else total}元{int(q) if q==int(q) else q}课时)")
        else:
            out.append(f"{n}({int(price) if price==int(price) else price}元/课时)")
    return '\n'.join(dict.fromkeys(out)) if out else '-'

def run():
    ensure_courses_table()
    page=1; size=50; all_rows=[]
    while True:
        body={'current':page,'size':size,'queryText':'','courseTypeEnums':[],'stateEnums':['ON','OFF']}
        r=requests.post(BASE+'/business/public/course/getCoursePage',params=Q,headers=H,json=body,timeout=30).json()
        if str(r.get('code'))!='200':
            raise SystemExit(r)
        res=r.get('result') or {}
        recs=res.get('records') or []
        all_rows.extend(recs)
        if page>=int(res.get('pages') or 1):
            break
        page+=1

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute('truncate table amilyhub.courses')
            for x in all_rows:
                items = pricing_items(x.get('coursePriceVO'))
                payload = dict(x)
                payload['pricing_items'] = items
                cur.execute('''
                    insert into amilyhub.courses(
                      source_course_id,name,course_type,fee_type,status,
                      pricing_rules,pricing_items,student_num,raw_source_json,raw_json
                    )
                    values(%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s::jsonb,%s::jsonb)
                ''',(
                    str(x.get('id')),
                    x.get('name') or '-',
                    map_type(x.get('type'), x.get('name') or ''),
                    '按课时' if (x.get('feeType') or '')=='CLASS_HOUR' else '按周期',
                    map_status(x.get('status')),
                    pricing_lines(items),
                    json.dumps(items,ensure_ascii=False),
                    int(x.get('studentNum') or 0),
                    json.dumps(x,ensure_ascii=False),
                    json.dumps(payload,ensure_ascii=False),
                ))
            conn.commit()
    print(json.dumps({'ok':True,'rows':len(all_rows)},ensure_ascii=False))

if __name__=='__main__':
    run()
