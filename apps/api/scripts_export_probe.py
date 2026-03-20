import requests
base='https://gateway.xiaomai5.com'
q={'p':'w','v':'v5.4.8','userType':'B','token':'c3b7458372bb4b1bb520909cbc24e71a','uid':'1219458615660421122','tid':'','aid':'1288326120321376258'}
common_headers={
 'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01',
 'originPath':'https://b.xiaomai5.com/#/teacher','userId':'1219458615660421122','xmrule':'latest','userType':'B','p':'w','deviceType':'w',
 'bizAccountId':'1288326120321376258','cid':'','orgAdminId':'','uid':'1219458615660421122','tid':'','token':'c3b7458372bb4b1bb520909cbc24e71a','xmToken':'c3b7458372bb4b1bb520909cbc24e71a','vn':'5.7.0','project':'xmzj-web-b','xmVersion':'5.0','v':'v5.4.8','instId':'1288069250509230081'
}
url=base+'/business/public/teacher/getTeacherBuffPage'
payload={'current':1,'size':10}
r=requests.post(url,params=q,headers=common_headers,json=payload,timeout=20)
print(r.status_code)
print(r.text[:900])
