const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const num=new Intl.NumberFormat('pt-BR');
const $=id=>document.getElementById(id);
const money=v=>brl.format(Number(v||0));
const number=v=>num.format(Math.round(Number(v||0)));
const pct=v=>`${Number(v||0).toFixed(2).replace('.',',')}%`;
let META, EXPO, charts={};

Promise.all([
  fetch('data/meta-dashboard-data.json').then(r=>r.json()),
  fetch('data/expo-dashboard-data.json').then(r=>r.json())
]).then(([m,e])=>{META=m;EXPO=e;init();});

function init(){
  document.querySelectorAll('.module-tab').forEach(btn=>{
    btn.onclick=()=>switchPanel(btn.dataset.panel);
  });
  $('monthSelect').innerHTML=META.meses.map(m=>`<option value="${m.chave}">${m.mes}</option>`).join('');
  $('monthSelect').value=META.meses[META.meses.length-1].chave;
  $('monthSelect').onchange=()=>renderMeta($('monthSelect').value);
  $('metaUpload').onchange=e=>readMetaFile(e.target.files[0]);
  $('expoUpload').onchange=e=>readExpoFile(e.target.files[0]);
  $('metaReset').onclick=()=>location.reload();
  $('expoReset').onclick=()=>location.reload();
  $('printMeta').onclick=()=>window.print();
  $('printExpo').onclick=()=>window.print();
  renderMeta($('monthSelect').value);
  renderExpo();
}

function switchPanel(panel){
  document.querySelectorAll('.module-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
  $('metaPanel').classList.toggle('hidden',panel!=='meta');
  $('warPanel').classList.toggle('hidden',panel!=='war');
  if(panel==='meta'){
    $('mainTitle').textContent='DESEMPENHO DE CAMPANHAS';
    $('mainSub').textContent='META ADS';
    $('mainDesc').textContent='ANÁLISE COMPLETA • DADOS MENSAIS + COMPARATIVO DOS ÚLTIMOS 3 MESES';
  }else{
    $('mainTitle').textContent='DASHBOARD DA DIRETORIA';
    $('mainSub').textContent='SALA DE GUERRA';
    $('mainDesc').textContent='VISÃO EXECUTIVA • EXPOCONSTRUIR 2026';
  }
}

function renderMeta(key){
  const m=META.meses.find(x=>x.chave===key);
  const prev=META.meses[META.meses.findIndex(x=>x.chave===key)-1];
  const campaigns=META.campanhas.filter(c=>c.mes===key).sort((a,b)=>b.conversas-a.conversas);

  $('metaKpis').innerHTML=[
    ['💰','Investimento total',money(m.investimento),'Mês selecionado'],
    ['💬','Conversas iniciadas',number(m.conversas),'WhatsApp'],
    ['🔗','Cliques no link',number(m.cliques),'Estimado'],
    ['👁️','Impressões',number(m.impressoes),'Volume'],
    ['📊','CTR',pct(m.ctr),'Taxa de clique'],
    ['🟠','Custo por conversa',money(m.cpa),'CPA'],
    ['🖱️','Custo por clique',money(m.cpc),'CPC']
  ].map(kpiCard).join('');

  $('monthMetrics').innerHTML=[
    ['💰','Investimento',money(m.investimento),'investimento',true],
    ['👁️','Impressões',number(m.impressoes),'impressoes'],
    ['👥','Alcance',number(m.alcance),'alcance'],
    ['🔗','Cliques no link',number(m.cliques),'cliques'],
    ['🟢','Conversas iniciadas',number(m.conversas),'conversas'],
    ['🟠','Custo por conversa',money(m.cpa),'cpa',true],
    ['📊','CTR',pct(m.ctr),'ctr'],
    ['🖱️','CPC',money(m.cpc),'cpc',true],
    ['🎯','Frequência',Number(m.frequencia||0).toFixed(2).replace('.',','),'frequencia',true]
  ].map(row=>metricRow(row,prev)).join('');

  $('monthHighlight').innerHTML=`🏆 <strong>Destaque do mês:</strong> CPA de ${money(m.cpa)} com ${number(m.conversas)} conversas iniciadas.`;
  $('miniCompare').innerHTML=miniCompareTable();
  renderFunnel(m);
  renderCampaignTable(campaigns,m);
  renderRanking(campaigns);
  renderCompare();
  $('metaInsights').innerHTML=META.insights.map(x=>`<li>${x}</li>`).join('');
  $('metaRecommendations').innerHTML=META.recomendacoes.map(x=>`<li>${x}</li>`).join('');

  makeChart('mainBarChart','bar',
    ['Impressões','Cliques','Conversas','Investimento'],
    [{label:m.mes,data:[m.impressoes,m.cliques,m.conversas,m.investimento],backgroundColor:['#2563eb','#a855f7','#22c55e','#f97316']}],
    false
  );

  const age=META.idade.filter(i=>i.mes===key);
  makeChart('ageChart','bar',age.map(i=>i.faixa),[{label:'CPA',data:age.map(i=>i.cpa),backgroundColor:['#22c55e','#facc15','#2563eb','#a855f7','#ef4444','#64748b']}],false);

  const gen=META.genero.filter(g=>g.mes===key);
  makeChart('genderChart','doughnut',gen.map(g=>g.nome),[{data:gen.map(g=>g.participacao),backgroundColor:['#2563eb','#ec4899','#64748b']}],true);
}

function kpiCard([icon,label,value,small]){
  return `<article class="kpi-card"><div class="icon">${icon}</div><span>${label}</span><b>${value}</b><small>${small}</small></article>`;
}

function metricRow([icon,label,value,field,invert],prev){
  const t=prev?trend(valueToNumber(value),Number(prev[field]||0),invert):'';
  return `<div class="metric-row"><div class="mi">${icon}</div><div><span>${label}</span><b>${value}</b></div><small>${t}</small></div>`;
}

function valueToNumber(v){
  return Number(String(v).replace('R$','').replace('%','').replace(/\./g,'').replace(',','.'))||0;
}

function trend(curr,prev,invert=false){
  if(!prev)return '';
  const d=(curr-prev)/prev*100;
  const good=invert?d<0:d>0;
  return `<span class="${good?'up':'down'}">${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(1).replace('.',',')}%</span>`;
}

function renderFunnel(m){
  const clickRate=m.impressoes?m.cliques/m.impressoes*100:0;
  const convRate=m.cliques?m.conversas/m.cliques*100:0;
  $('funnelResult').innerHTML=`
    <div class="funnel-viz">
      <div class="funnel-step"><span>Impressões</span><b>${number(m.impressoes)}</b></div>
      <div class="funnel-step"><span>Cliques • ${pct(clickRate)}</span><b>${number(m.cliques)}</b></div>
      <div class="funnel-step"><span>Conversas • ${pct(convRate)}</span><b>${number(m.conversas)}</b></div>
      <div class="funnel-step"><span>CPA</span><b>${money(m.cpa)}</b></div>
    </div>
    <div class="funnel-note">
      Leitura correta: cliques são ${pct(clickRate)} das impressões; conversas são ${pct(convRate)} dos cliques.
      ROI operacional: ${Number(m.roiOperacional||0).toFixed(3).replace('.',',')} conversas por real investido.
    </div>`;
}

function renderCampaignTable(camps,m){
  const totals=camps.reduce((a,c)=>({
    investimento:a.investimento+c.investimento,
    impressoes:a.impressoes+(c.impressoes||0),
    cliques:a.cliques+c.cliques,
    conversas:a.conversas+c.conversas
  }),{investimento:0,impressoes:0,cliques:0,conversas:0});
  const avgCpa=totals.conversas?totals.investimento/totals.conversas:0;
  $('campaignTable').innerHTML=`
  <table class="table">
    <thead><tr><th>Campanha</th><th>Invest.</th><th>Impress.</th><th>Cliques</th><th>Conv.</th><th>CPA</th><th>CPC</th><th>CTR</th></tr></thead>
    <tbody>${camps.map(c=>`<tr><td>${c.nome}</td><td>${money(c.investimento)}</td><td>${number(c.impressoes)}</td><td>${number(c.cliques)}</td><td>${number(c.conversas)}</td><td>${c.cpa?money(c.cpa):'–'}</td><td>${money(c.cpc)}</td><td>${pct(c.ctr)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total do mês</td><td>${money(totals.investimento)}</td><td>${number(totals.impressoes)}</td><td>${number(totals.cliques)}</td><td>${number(totals.conversas)}</td><td>${money(avgCpa)}</td><td>–</td><td>${pct(m.ctr)}</td></tr></tfoot>
  </table>`;
}

function renderRanking(camps){
  const valid=camps.slice().sort((a,b)=>(a.cpa||999999)-(b.cpa||999999)).slice(0,5);
  $('rankingCampaigns').innerHTML=valid.map((c,i)=>`
    <div class="rank-item">
      <div class="rank-badge">${i+1}</div>
      <div><h4>${c.nome}</h4><span>${number(c.conversas)} conversas • ${money(c.investimento)} investidos</span></div>
      <b>${c.cpa?money(c.cpa):'–'}</b>
    </div>`).join('');
}

function renderCompare(){
  $('monthCompare').innerHTML=META.meses.slice(-3).map(m=>`
    <div class="month-card-compare">
      <h4>${m.mes}</h4>
      ${compareLine('Investimento',money(m.investimento))}
      ${compareLine('Impressões',number(m.impressoes))}
      ${compareLine('Alcance',number(m.alcance))}
      ${compareLine('Cliques',number(m.cliques))}
      ${compareLine('Conversas',number(m.conversas))}
      ${compareLine('CPA',money(m.cpa))}
      ${compareLine('CTR',pct(m.ctr))}
      ${compareLine('CPC',money(m.cpc))}
      <div class="compare-roi">Conversas/R$ ${Number(m.roiOperacional||0).toFixed(3).replace('.',',')}</div>
    </div>`).join('');
}

function compareLine(a,b){return `<div class="compare-line"><span>${a}</span><b>${b}</b></div>`}

function miniCompareTable(){
  return `<table class="table"><thead><tr><th>Indicador</th>${META.meses.slice(-3).map(m=>`<th>${m.mes.split('/')[0]}</th>`).join('')}</tr></thead>
    <tbody>
      ${['investimento','impressoes','cliques','conversas','cpa','ctr','cpc'].map(k=>`<tr><td>${label(k)}</td>${META.meses.slice(-3).map(m=>`<td>${format(k,m[k])}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
}

function label(k){return {investimento:'Invest.',impressoes:'Impress.',cliques:'Cliques',conversas:'Conversas',cpa:'CPA',ctr:'CTR',cpc:'CPC'}[k]||k}
function format(k,v){return ['investimento','cpa','cpc'].includes(k)?money(v):k==='ctr'?pct(v):number(v)}

function renderExpo(){
  const r=EXPO.realizado, meta=EXPO.metas;
  const conv=r.leads?r.oportunidades/r.leads*100:0;
  $('warKpis').innerHTML=[
    ['👥','Leads capturados',number(r.leads),`Meta: ${number(meta.leads)}`],
    ['📞','Ligações realizadas',number(r.ligacoes),`Meta: ${number(meta.ligacoes)}`],
    ['💬','Reuniões agendadas',number(r.reunioes),`Meta: ${number(meta.reunioes)}`],
    ['🔻','Oportunidades',number(r.oportunidades),`Meta: ${number(meta.oportunidades)}`],
    ['📈','Conversão',pct(conv),`Meta: ${pct(meta.conversao)}`],
    ['💵','Faturamento',money(r.faturamento),`Meta: ${money(meta.faturamento)}`]
  ].map(kpiCard).join('');

  $('warFunnel').innerHTML=`
    <div class="funnel-viz">
      <div class="funnel-step"><span>Visitantes</span><b>${number(r.visitantes)}</b></div>
      <div class="funnel-step"><span>Leads</span><b>${number(r.leads)}</b></div>
      <div class="funnel-step"><span>Reuniões</span><b>${number(r.reunioes)}</b></div>
      <div class="funnel-step"><span>Oportunidades</span><b>${number(r.oportunidades)}</b></div>
    </div>`;
  $('warGoal').innerHTML=`<span>Meta final</span><br><b>${money(meta.faturamento)}</b><br>em oportunidades`;
  $('teamTable').innerHTML=`
    <table class="table"><thead><tr><th>Vendedor</th><th>Leads</th><th>Ligações</th><th>Reuniões</th><th>Oport.</th><th>Fat.</th></tr></thead>
    <tbody>${EXPO.vendedores.map(v=>`<tr><td>${v.nome}</td><td>${number(v.leads)}</td><td>${number(v.ligacoes)}</td><td>${number(v.reunioes)}</td><td>${number(v.oportunidades)}</td><td>${money(v.faturamento)}</td></tr>`).join('')}</tbody></table>`;
  $('appCards').innerHTML=EXPO.apps.map(a=>`<span class="app-pill">${a.nome}: ${number(a.cadastros)} cadastros</span>`).join('');
  $('warAlerts').innerHTML=[
    'Atualizar CRM todos os dias até 18h.',
    'Revisar oportunidades acima de D+20.',
    'Priorizar leads quentes com valor potencial alto.',
    'Gerar relatório de follow-up 48h após cada dia de feira.'
  ].map(x=>`<li>${x}</li>`).join('');
  $('warOpportunities').innerHTML=`<div class="opportunity-table"><table class="table"><thead><tr><th>Empresa</th><th>Negócio</th><th>Valor</th><th>Prob.</th><th>Prev.</th></tr></thead><tbody>${EXPO.oportunidades.map(o=>`<tr><td>${o.empresa}</td><td>${o.negocio}</td><td>${money(o.valor)}</td><td>${o.prob}%</td><td>${o.previsao}</td></tr>`).join('')}</tbody></table></div>`;
  makeChart('warMetaChart','bar',['Leads','Ligações','Reuniões','Oport.','Apps'],[
    {label:'Realizado',data:[r.leads,r.ligacoes,r.reunioes,r.oportunidades,r.apps],backgroundColor:'#22c55e'},
    {label:'Meta',data:[meta.leads,meta.ligacoes,meta.reunioes,meta.oportunidades,meta.apps],backgroundColor:'#facc15'}
  ],false);
  makeChart('originChart','doughnut',EXPO.origem.map(o=>o.nome),[{data:EXPO.origem.map(o=>o.valor),backgroundColor:['#2563eb','#22c55e','#facc15','#a855f7','#ef4444']}],true);
}

function makeChart(id,type,labels,datasets,noScales=false){
  if(charts[id])charts[id].destroy();
  const ctx=$(id);
  charts[id]=new Chart(ctx,{type,data:{labels,datasets},options:{
    responsive:true,
    plugins:{legend:{labels:{color:'#fff',font:{weight:'bold'}}}},
    scales:noScales||type==='doughnut'?{}:{x:{ticks:{color:'#fff'},grid:{color:'rgba(255,255,255,.08)'}},y:{ticks:{color:'#fff'},grid:{color:'rgba(255,255,255,.08)'}}}
  }});
}

async function readMetaFile(file){
  if(!file)return;
  const wb=await readWorkbook(file);
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
  const parsed=parseMeta(rows);
  if(parsed.meses.length){
    META={...META,...parsed,insights:META.insights,recomendacoes:META.recomendacoes};
    $('monthSelect').innerHTML=META.meses.map(m=>`<option value="${m.chave}">${m.mes}</option>`).join('');
    $('monthSelect').value=META.meses[META.meses.length-1].chave;
    renderMeta($('monthSelect').value);
    alert('Planilha Meta Ads importada com sucesso!');
  }else alert('Não consegui identificar os meses da planilha.');
}

async function readExpoFile(file){
  if(!file)return;
  const wb=await readWorkbook(file);
  EXPO=parseExpo(wb);
  renderExpo();
  alert('Planilha Sala de Guerra importada com sucesso!');
}

function readWorkbook(file){return file.arrayBuffer().then(b=>XLSX.read(b,{type:'array'}))}
function n(v){if(typeof v==='number')return v;return Number(String(v||'').replace('R$','').replace('%','').replace(/\./g,'').replace(',','.'))||0}
function key(raw){const m=String(raw||'').match(/(20\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}`:''}

function parseMeta(rows){
  const g={};
  rows.forEach(r=>{
    const k=key(r['Mês']||r['Início dos relatórios']||'');
    if(!k)return;
    if(!g[k])g[k]={spend:0,impr:0,reach:0,clicks:0,conv:0,camps:{}};
    const spend=n(r['Valor usado (BRL)']);
    const impr=n(r['Impressões']);
    const reach=n(r['Alcance']);
    const tipo=String(r['Tipo de resultado']||'');
    const res=n(r['Resultados']);
    const cpc=n(r['CPC (custo por clique no link)']);
    const clicks=tipo.includes('Cliques')?res:(cpc?spend/cpc:0);
    const conv=tipo.includes('Conversas')?res:0;
    g[k].spend+=spend;g[k].impr+=impr;g[k].reach+=reach;g[k].clicks+=clicks;g[k].conv+=conv;
    const camp=r['Nome da campanha']||'Sem campanha';
    if(!g[k].camps[camp])g[k].camps[camp]={spend:0,impr:0,reach:0,clicks:0,conv:0};
    g[k].camps[camp].spend+=spend;g[k].camps[camp].impr+=impr;g[k].camps[camp].reach+=reach;g[k].camps[camp].clicks+=clicks;g[k].camps[camp].conv+=conv;
  });
  const keys=Object.keys(g).sort();
  const meses=keys.map(k=>({mes:k,chave:k,investimento:g[k].spend,impressoes:g[k].impr,alcance:g[k].reach,cliques:Math.round(g[k].clicks),conversas:g[k].conv,cpa:g[k].conv?g[k].spend/g[k].conv:0,ctr:g[k].impr?g[k].clicks/g[k].impr*100:0,cpc:g[k].clicks?g[k].spend/g[k].clicks:0,cpm:g[k].impr?g[k].spend/g[k].impr*1000:0,frequencia:g[k].reach?g[k].impr/g[k].reach:0,roiOperacional:g[k].spend?g[k].conv/g[k].spend:0}));
  const campanhas=[];
  keys.forEach(k=>Object.entries(g[k].camps).forEach(([nome,v])=>campanhas.push({mes:k,nome,investimento:v.spend,impressoes:v.impr,alcance:v.reach,cliques:Math.round(v.clicks),conversas:v.conv,cpa:v.conv?v.spend/v.conv:0,ctr:v.impr?v.clicks/v.impr*100:0,cpc:v.clicks?v.spend/v.clicks:0,cpm:v.impr?v.spend/v.impr*1000:0,iec:Math.round((v.conv*5)+(v.clicks?20:0))})));
  return {meses,campanhas,idade:META.idade,genero:META.genero};
}

function parseExpo(wb){
  const e=JSON.parse(JSON.stringify(EXPO));
  const leads=XLSX.utils.sheet_to_json(wb.Sheets['Leads']||{}, {defval:''});
  const equipe=XLSX.utils.sheet_to_json(wb.Sheets['Equipe']||{}, {defval:''});
  const apps=XLSX.utils.sheet_to_json(wb.Sheets['Apps']||{}, {defval:''});
  e.realizado.leads=leads.length;
  e.realizado.visitantes=leads.length;
  e.realizado.ligacoes=leads.filter(x=>String(x.Status||'').toLowerCase().includes('contat')).length;
  e.realizado.reunioes=leads.filter(x=>String(x.Proxima_Acao||'').toLowerCase().includes('reuni')).length;
  e.realizado.oportunidades=leads.filter(x=>String(x.Status||'').toLowerCase().includes('oportun')).length;
  e.realizado.faturamento=leads.reduce((s,x)=>s+n(x.Valor_Potencial),0);
  e.realizado.apps=apps.reduce((s,x)=>s+n(x.Cadastros),0);
  if(equipe.length)e.vendedores=equipe.map(x=>({nome:x.Vendedor||'Vendedor',leads:n(x.Leads),ligacoes:n(x.Ligacoes),reunioes:n(x.Reunioes),oportunidades:n(x.Oportunidades),faturamento:n(x.Faturamento)}));
  if(apps.length)e.apps=apps.map(x=>({nome:x.App||'App',cadastros:n(x.Cadastros)}));
  const origem={};
  leads.forEach(x=>{const o=x.Origem||'Não informado';origem[o]=(origem[o]||0)+1});
  e.origem=Object.entries(origem).map(([nome,valor])=>({nome,valor}));
  return e;
}
