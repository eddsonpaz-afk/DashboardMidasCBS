let dashboardData = null;
let mainChart, ageChart, genderChart;

const fmtBRL = v => (v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtNum = v => Math.round(v || 0).toLocaleString('pt-BR');
const fmtPct = v => `${(v || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const labelMonth = m => {
  const [y, mo] = m.split('-');
  const names = { '01':'JAN', '02':'FEV', '03':'MAR', '04':'ABR', '05':'MAI', '06':'JUN', '07':'JUL', '08':'AGO', '09':'SET', '10':'OUT', '11':'NOV', '12':'DEZ' };
  return `${names[mo] || mo}/${y}`;
};
function trendHtml(v, invert=false){
  if(v === null || v === undefined) return '<span class="trend">base</span>';
  const good = invert ? v < 0 : v > 0;
  const arrow = v > 0 ? '▲' : '▼';
  return `<span class="trend ${good?'up':'down'}">${arrow} ${Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%</span>`;
}

async function loadData(){
  const res = await fetch('./data/meta-dashboard-data.json');
  dashboardData = await res.json();
  init();
}
function init(){
  renderKpis();
  renderMonthSelector();
  renderFunnel();
  renderCompareTable();
  renderRanking();
  renderChartsBase();
  renderInsights();
  const last = dashboardData.months[dashboardData.months.length-1]?.name;
  updateSelectedMonth(last);
}
function renderKpis(){
  const t = dashboardData.total;
  const items = [
    ['$', 'Investimento total', fmtBRL(t.spend), 'blue'],
    ['☘', 'Conversas iniciadas', fmtNum(t.conversations), 'green'],
    ['🔗', 'Cliques no link', fmtNum(t.clicks), 'purple'],
    ['👁', 'Impressões', fmtNum(t.impressions), 'orange'],
    ['📊', 'CTR', fmtPct(t.ctr), 'cyan'],
    ['💰', 'Custo por conversa', fmtBRL(t.cpa), 'yellow'],
    ['🖱', 'Custo por clique', fmtBRL(t.cpc), 'red'],
  ];
  document.getElementById('kpis').innerHTML = items.map(i => `<div class="kpi"><div class="icon ${i[3]}">${i[0]}</div><div><small>${i[1]}</small><strong>${i[2]}</strong></div></div>`).join('');
}
function renderMonthSelector(){
  const sel = document.getElementById('monthSelect');
  sel.innerHTML = dashboardData.months.map(m=>`<option value="${m.name}">${labelMonth(m.name)}</option>`).join('');
  sel.value = dashboardData.months[dashboardData.months.length-1].name;
  sel.addEventListener('change', e => updateSelectedMonth(e.target.value));
}
function updateSelectedMonth(month){
  const m = dashboardData.months.find(x=>x.name===month);
  if(!m) return;
  document.getElementById('chartLabel').textContent = labelMonth(month);
  document.getElementById('campaignMonthLabel').textContent = labelMonth(month);
  const c = m.comparison || {};
  const rows = [
    ['$', 'Investimento', fmtBRL(m.spend), trendHtml(c.spend, false), 'blue'],
    ['👁', 'Impressões', fmtNum(m.impressions), trendHtml(c.impressions, false), 'orange'],
    ['👥', 'Alcance', fmtNum(m.reach), trendHtml(c.reach, false), 'green'],
    ['🔗', 'Cliques no link', fmtNum(m.clicks), trendHtml(c.clicks, false), 'purple'],
    ['🟢', 'Conversas iniciadas', fmtNum(m.conversations), trendHtml(c.conversations, false), 'green'],
    ['💰', 'CPA', fmtBRL(m.cpa), trendHtml(c.cpa, true), 'yellow'],
    ['📊', 'CTR', fmtPct(m.ctr), trendHtml(c.ctr, false), 'cyan'],
    ['🖱', 'CPC', fmtBRL(m.cpc), trendHtml(c.cpc, true), 'red'],
    ['🎯', 'Frequência', m.frequency.toLocaleString('pt-BR',{minimumFractionDigits:2}), trendHtml(c.frequency, true), 'orange'],
  ];
  document.getElementById('selectedMonthMetrics').innerHTML = rows.map(r=>`<div class="metric-row"><div class="bubble ${r[4]}">${r[0]}</div><div><small>${r[1]}</small><strong>${r[2]}</strong></div><div>${r[3]}</div></div>`).join('');
  document.getElementById('monthHighlight').innerHTML = `<strong>Destaque do mês</strong><br>ROI operacional: <b>${m.roi_operational}</b> conversas por R$ 1 investido.`;
  renderMainChart(month);
  renderCampaigns(month);
}
function renderMainChart(month){
  const m = dashboardData.months.find(x=>x.name===month);
  const labels = ['Impressões','Cliques','Conversas','Investimento'];
  const data = [m.impressions, m.clicks, m.conversations, m.spend];
  const colors = ['#2563eb','#a855f7','#22c55e','#f97316'];
  if(mainChart) mainChart.destroy();
  mainChart = new Chart(document.getElementById('mainChart'), {type:'bar', data:{labels, datasets:[{label:labelMonth(month), data, backgroundColor:colors, borderRadius:8}]}, options:{responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#fff'}, grid:{color:'rgba(255,255,255,.05)'}}, y:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,.08)'}}}}});
}
function renderFunnel(){
  const t = dashboardData.total;
  const clickRate = t.impressions ? t.clicks/t.impressions*100 : 0;
  const convRate = t.impressions ? t.conversations/t.impressions*100 : 0;
  const roi = t.roi_operational;
  const steps = [
    ['👁','Impressões',fmtNum(t.impressions),'100%'],
    ['🖱','Cliques no link',fmtNum(t.clicks),fmtPct(clickRate)],
    ['✅','Conversas iniciadas',fmtNum(t.conversations),fmtPct(convRate)],
    ['👥','Conversas / R$ investido',roi.toString(),'ROI operacional'],
  ];
  document.getElementById('funnel').innerHTML = steps.map(s=>`<div class="funnel-step"><div class="funnel-icon blue">${s[0]}</div><div class="funnel-label"><small>${s[1]}</small><strong>${s[2]}</strong></div><div class="funnel-bar">${s[3]}</div></div>`).join('');
}
function renderCompareTable(){
  const metrics = [
    ['Investimento','spend',fmtBRL], ['Impressões','impressions',fmtNum], ['Alcance','reach',fmtNum], ['Cliques','clicks',fmtNum], ['Conversas','conversations',fmtNum], ['CPA','cpa',fmtBRL], ['CTR','ctr',fmtPct], ['CPC','cpc',fmtBRL], ['ROI Operacional','roi_operational',v=>v]
  ];
  const heads = dashboardData.months.map(m=>labelMonth(m.name));
  let html = `<thead><tr><th>Indicador</th>${heads.map(h=>`<th>${h}</th>`).join('')}<th>Tendência</th></tr></thead><tbody>`;
  metrics.forEach(([label,key,fmt])=>{
    const vals = dashboardData.months.map(m=>m[key]);
    const diff = vals.length>1 && vals[0] ? ((vals[vals.length-1]-vals[0])/vals[0]*100) : null;
    html += `<tr><td>${label}</td>${vals.map(v=>`<td class="num">${fmt(v)}</td>`).join('')}<td>${trendHtml(diff, key==='cpa'||key==='cpc')}</td></tr>`;
  });
  html += '</tbody>';
  document.getElementById('compareTable').innerHTML = html;
}
function renderCampaigns(month){
  const rows = dashboardData.month_campaigns.filter(c=>c.month===month).sort((a,b)=>b.conversations-a.conversations || a.cpa-b.cpa).slice(0,8);
  let html = '<thead><tr><th>Campanha</th><th>Invest.</th><th>Imp.</th><th>Cliques</th><th>Conversas</th><th>CPA</th><th>CTR</th></tr></thead><tbody>';
  html += rows.map(r=>`<tr><td>${r.name}</td><td class="num">${fmtBRL(r.spend)}</td><td class="num">${fmtNum(r.impressions)}</td><td class="num">${fmtNum(r.clicks)}</td><td class="num">${fmtNum(r.conversations)}</td><td class="num">${r.cpa?fmtBRL(r.cpa):'-'}</td><td class="num">${fmtPct(r.ctr)}</td></tr>`).join('');
  html += '</tbody>';
  document.getElementById('campaignsTable').innerHTML = html;
}
function renderRanking(){
  const rows = dashboardData.campaigns.slice(0,8);
  let html = '<thead><tr><th>#</th><th>Campanha</th><th>IEC</th><th>Status</th><th>Conversas</th><th>CPA</th></tr></thead><tbody>';
  html += rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td class="num"><b>${r.iec}</b></td><td><span class="tag ${r.status==='Escalar'?'scale':r.status==='Otimizar'?'optimize':'pause'}">${r.status}</span></td><td class="num">${fmtNum(r.conversations)}</td><td class="num">${r.cpa?fmtBRL(r.cpa):'-'}</td></tr>`).join('');
  html += '</tbody>';
  document.getElementById('rankingTable').innerHTML = html;
}
function renderChartsBase(){
  const ages = dashboardData.ages.filter(a=>a.spend>0).map(a=>({name:a.name,cpa:a.cpa||0}));
  if(ageChart) ageChart.destroy();
  ageChart = new Chart(document.getElementById('ageChart'), {type:'bar', data:{labels:ages.map(a=>a.name), datasets:[{data:ages.map(a=>a.cpa), backgroundColor:['#22c55e','#facc15','#2563eb','#a855f7','#ef4444','#9ca3af'], borderRadius:8}]}, options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,.08)'}}, y:{ticks:{color:'#fff'}, grid:{display:false}}}}});
  const genders = dashboardData.genders.filter(g=>g.spend>0);
  if(genderChart) genderChart.destroy();
  genderChart = new Chart(document.getElementById('genderChart'), {type:'doughnut', data:{labels:genders.map(g=>g.name), datasets:[{data:genders.map(g=>g.spend), backgroundColor:['#2563eb','#ec4899','#9ca3af']}]}, options:{plugins:{legend:{labels:{color:'#fff'}}}, cutout:'62%'}});
}
function renderInsights(){
  const bestCamp = dashboardData.campaigns[0];
  const bestMonth = [...dashboardData.months].sort((a,b)=>b.roi_operational-a.roi_operational)[0];
  const last = dashboardData.months[dashboardData.months.length-1];
  const insights = [
    `<b>${bestCamp.name}</b> lidera o IEC com nota ${bestCamp.iec}.`,
    `<b>${labelMonth(bestMonth.name)}</b> teve o melhor ROI operacional: ${bestMonth.roi_operational} conversas por R$ 1.`,
    `CPA do último mês: <b>${fmtBRL(last.cpa)}</b>, ${trendHtml(last.comparison?.cpa, true)} vs mês anterior.`,
    `CTR do último mês: <b>${fmtPct(last.ctr)}</b>, ${trendHtml(last.comparison?.ctr, false)} vs mês anterior.`,
    `ROAS financeiro não aparece na base. Para ROI real, integrar vendas por campanha.`
  ];
  document.getElementById('insights').innerHTML = insights.map(i=>`<li>${i}</li>`).join('');
}

// Optional spreadsheet import in browser
function parseUploadedWorkbook(workbook){
  const firstName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstName], {defval:null});
  // Minimal parser mirrors the backend fields
  const clean = rows.map(r=>({
    campaign: r['Nome da campanha'] || '', ad: r['Nome do anúncio'] || '', gender: r['Gênero'] || '', age: r['Idade'] || '',
    month: String(r['Mês'] || '').slice(0,7), result_type: r['Tipo de resultado'] || '',
    spend: Number(r['Valor usado (BRL)'] || 0), impressions: Number(r['Impressões'] || 0), reach: Number(r['Alcance'] || 0),
    cpc: Number(r['CPC (custo por clique no link)'] || 0), results: Number(r['Resultados'] || 0),
    engagements: Number(r['Engajamentos com o post'] || 0), video3s: Number(r['Reproduções do vídeo por no mínimo 3 segundos'] || 0)
  }));
  alert('Planilha lida. Para consolidar exatamente igual ao modelo, rode o script scripts/parse-data.js ou substitua data/meta-dashboard-data.json.');
}
document.getElementById('xlsxInput').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = evt => parseUploadedWorkbook(XLSX.read(evt.target.result, {type:'array'}));
  reader.readAsArrayBuffer(file);
});
document.getElementById('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(dashboardData,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='meta-dashboard-data.json'; a.click(); URL.revokeObjectURL(url);
});
loadData();
