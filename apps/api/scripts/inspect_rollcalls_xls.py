import json
import pandas as pd
from pathlib import Path
p=Path('exports/raw/export_20260320_130436/rollcalls_export_student.xls')
out=Path('exports/raw/export_20260320_130436/rollcalls_export_student.schema.json')
if not p.exists():
    raise SystemExit('xls not found')
# try default engine auto detect
df=pd.read_excel(p)
meta={
  'rows': int(len(df)),
  'columns': [str(c) for c in df.columns],
  'sample': df.head(3).fillna('').to_dict(orient='records')
}
out.write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps({'rows':meta['rows'],'columns':len(meta['columns']),'schema':str(out)},ensure_ascii=False))
