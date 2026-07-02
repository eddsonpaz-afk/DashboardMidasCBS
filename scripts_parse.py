import zipfile, xml.etree.ElementTree as ET, re, json, math
from collections import defaultdict
from pathlib import Path

xlsx_path = '/mnt/data/Relatório-sem-título (4).xlsx'
out_dir = Path('/mnt/data/meta-dashboard-waves-cbs/data')
out_dir.mkdir(parents=True, exist_ok=True)

def col_to_idx(cell_ref):
    m = re.match(r'([A-Z]+)', cell_ref)
    col = m.group(1)
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n - 1

def parse_xlsx_first_sheet(path):
    ns = {
        'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    }
    with zipfile.ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('main:si', ns):
                texts = []
                for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                    texts.append(t.text or '')
                shared.append(''.join(texts))
        wbroot = ET.fromstring(z.read('xl/workbook.xml'))
        sheet_el = wbroot.find('main:sheets/main:sheet', ns)
        rid = sheet_el.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        relroot = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = None
        for rel in relroot:
            if rel.attrib.get('Id') == rid:
                target = rel.attrib['Target']
                break
        sheet_path = 'xl/' + target if not target.startswith('xl/') else target
        root = ET.fromstring(z.read(sheet_path))
        rows = []
        max_col = 0
        for row in root.findall('.//main:sheetData/main:row', ns):
            vals = {}
            for c in row.findall('main:c', ns):
                ref = c.attrib.get('r', 'A1')
                idx = col_to_idx(ref)
                max_col = max(max_col, idx + 1)
                t = c.attrib.get('t')
                v = c.find('main:v', ns)
                is_el = c.find('main:is', ns)
                value = None
                if t == 's' and v is not None:
                    value = shared[int(v.text)]
                elif t == 'inlineStr' and is_el is not None:
                    value = ''.join(tt.text or '' for tt in is_el.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                elif v is not None:
                    txt = v.text
                    try:
                        if txt is not None and re.match(r'^-?\d+(\.\d+)?$', txt):
                            value = float(txt)
                            if value.is_integer(): value = int(value)
                        else:
                            value = txt
                    except Exception:
                        value = txt
                vals[idx] = value
            if vals:
                rows.append([vals.get(i) for i in range(max_col)])
        return rows

def f(x):
    if x in (None, '', '–'):
        return 0.0
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).replace('R$', '').replace('%', '').strip().replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def t(x):
    return '' if x is None else str(x)

matrix = parse_xlsx_first_sheet(xlsx_path)
headers = [str(h).strip() if h is not None else '' for h in matrix[0]]
records = []
for row in matrix[1:]:
    rec = {h: row[i] if i < len(row) else None for i,h in enumerate(headers)}
    rec['campaign'] = t(rec.get('Nome da campanha'))
    rec['ad'] = t(rec.get('Nome do anúncio'))
    rec['gender'] = t(rec.get('Gênero'))
    rec['age'] = t(rec.get('Idade'))
    rec['month'] = t(rec.get('Mês'))[:7]
    rec['result_type'] = t(rec.get('Tipo de resultado'))
    rec['spend'] = f(rec.get('Valor usado (BRL)'))
    rec['impressions'] = f(rec.get('Impressões'))
    rec['reach'] = f(rec.get('Alcance'))
    rec['frequency'] = f(rec.get('Frequência'))
    rec['cpc'] = f(rec.get('CPC (custo por clique no link)'))
    rec['ctr'] = f(rec.get('CTR (todos)'))
    rec['result_cost'] = f(rec.get('Custo por resultado'))
    rec['results'] = f(rec.get('Resultados'))
    rec['engagements'] = f(rec.get('Engajamentos com o post'))
    rec['video3s'] = f(rec.get('Reproduções do vídeo por no mínimo 3 segundos'))
    rec['clicks_link'] = rec['results'] if rec['result_type'].lower().startswith('cliques') else (rec['spend'] / rec['cpc'] if rec['cpc'] > 0 and rec['cpc'] < 30 else 0)
    records.append(rec)

def aggregate(items, key_fn):
    groups = defaultdict(lambda: {'spend':0,'impressions':0,'reach':0,'clicks':0,'conversations':0,'profile_visits':0,'engagements':0,'video3s':0,'rows':0})
    for r in items:
        k = key_fn(r)
        g = groups[k]
        g['rows'] += 1
        g['spend'] += r['spend']
        g['impressions'] += r['impressions']
        g['reach'] += r['reach']
        g['clicks'] += r['clicks_link']
        g['engagements'] += r['engagements']
        g['video3s'] += r['video3s']
        if r['result_type'] == 'Conversas por mensagem iniciadas':
            g['conversations'] += r['results']
        elif r['result_type'] == 'Visitas ao perfil e à Página':
            g['profile_visits'] += r['results']
    return groups

def finalize(name, g):
    spend, impr, reach = g['spend'], g['impressions'], g['reach']
    clicks, conv = g['clicks'], g['conversations']
    return {
        'name': name,
        'spend': round(spend, 2),
        'impressions': round(impr),
        'reach': round(reach),
        'frequency': round(impr / reach, 2) if reach else 0,
        'clicks': round(clicks),
        'ctr': round(clicks / impr * 100, 3) if impr else 0,
        'cpc': round(spend / clicks, 2) if clicks else 0,
        'cpm': round(spend / impr * 1000, 2) if impr else 0,
        'conversations': round(conv),
        'cpa': round(spend / conv, 2) if conv else 0,
        'profile_visits': round(g['profile_visits']),
        'engagements': round(g['engagements']),
        'video3s': round(g['video3s']),
        'roi_operational': round(conv / spend, 4) if spend else 0,
        'rows': g['rows']
    }

months = aggregate(records, lambda r: r['month'])
campaigns = aggregate(records, lambda r: r['campaign'])
month_campaigns = aggregate(records, lambda r: f"{r['month']}||{r['campaign']}")
genders = aggregate(records, lambda r: r['gender'] or 'unknown')
ages = aggregate(records, lambda r: r['age'] or 'unknown')
ads = aggregate(records, lambda r: r['ad'])
total = finalize('Total', aggregate(records, lambda r: 'Total')['Total'])

month_data = [finalize(k, v) for k,v in sorted(months.items())]
# Add comparisons vs previous
for i, m in enumerate(month_data):
    if i == 0:
        m['comparison'] = {}
    else:
        prev = month_data[i-1]
        comp = {}
        for key in ['spend','impressions','reach','clicks','conversations','cpa','ctr','cpc','cpm','frequency','roi_operational']:
            if prev[key]:
                comp[key] = round((m[key]-prev[key])/prev[key]*100, 1)
            else:
                comp[key] = None
        m['comparison'] = comp

# Simple IEC
camp_list = [finalize(k,v) for k,v in campaigns.items()]
def normalize(vals, higher=True):
    mn, mx = min(vals), max(vals)
    if mx == mn: return [50]*len(vals)
    return [((v-mn)/(mx-mn)*100 if higher else (mx-v)/(mx-mn)*100) for v in vals]
ctr_s = normalize([c['ctr'] for c in camp_list], True)
cpc_s = normalize([c['cpc'] if c['cpc'] else 999 for c in camp_list], False)
cpa_s = normalize([c['cpa'] if c['cpa'] else 999 for c in camp_list], False)
conv_s = normalize([c['conversations'] for c in camp_list], True)
roi_s = normalize([c['roi_operational'] for c in camp_list], True)
for i,c in enumerate(camp_list):
    c['iec'] = round(0.25*cpa_s[i] + 0.20*ctr_s[i] + 0.15*cpc_s[i] + 0.25*conv_s[i] + 0.15*roi_s[i], 1)
    c['status'] = 'Escalar' if c['iec'] >= 75 else ('Otimizar' if c['iec'] >= 45 else 'Recriar/Pausar')

month_campaign_data = []
for k, v in month_campaigns.items():
    month, campaign = k.split('||', 1)
    row = finalize(campaign, v)
    row['month'] = month
    month_campaign_data.append(row)

out = {
    'generated_from': 'Relatório-sem-título (4).xlsx',
    'brand': {'title':'Desempenho de Campanhas Meta Ads', 'subtitle':'CBS + Waves Plus'},
    'total': total,
    'months': month_data,
    'campaigns': sorted(camp_list, key=lambda x: x['iec'], reverse=True),
    'month_campaigns': sorted(month_campaign_data, key=lambda x: (x['month'], -x['spend'])),
    'genders': sorted([finalize(k,v) for k,v in genders.items()], key=lambda x: -x['spend']),
    'ages': sorted([finalize(k,v) for k,v in ages.items()], key=lambda x: x['name']),
    'ads': sorted([finalize(k,v) for k,v in ads.items()], key=lambda x: -x['spend'])[:20],
    'raw': records
}
with open(out_dir / 'meta-dashboard-data.json', 'w', encoding='utf-8') as fp:
    json.dump(out, fp, ensure_ascii=False, indent=2)
print(out_dir / 'meta-dashboard-data.json')
