import json
from pathlib import Path
out=Path('exports/raw/export_20260320_130436')
summary={}
for name in ['teachers','students_learning','orders','income_expense','hour_cost_flows']:
    f=out/f'{name}.jsonl'
    if f.exists():
        summary[name]={'file':str(f),'rows':sum(1 for _ in f.open('r',encoding='utf-8')),'sizeBytes':f.stat().st_size}
meta=out/'rollcalls_export_student.meta.json'
if meta.exists():
    m=json.loads(meta.read_text())
    summary['rollcalls_export_student']={'file':m['file'],'sizeBytes':m['sizeBytes'],'exportId':m['exportId'],'resourceId':m['resourceId']}
(out/'export_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
