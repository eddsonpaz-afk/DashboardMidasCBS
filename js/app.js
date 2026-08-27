const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const num=new Intl.NumberFormat('pt-BR');
const percentNumber=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const $=id=>document.getElementById(id);
const money=v=>brl.format(Number(v||0));
const number=v=>num.format(Math.round(Number(v||0)));
const pct=v=>`${percentNumber.format(Number(v||0))}%`;
const hasValue=v=>MidasMetaParser.hasValue(v);
const moneyMaybe=v=>hasValue(v)?money(v):'Não informado';
const numberMaybe=v=>hasValue(v)?number(v):'Não informado';
const pctMaybe=v=>hasValue(v)?pct(v):'Não informado';
const multipleMaybe=v=>hasValue(v)?`${Number(v).toFixed(2).replace('.',',')}x`:'Não informado';
let META, EXPO, charts={};

const GOOGLE_SHEET_CSV='https://docs.google.com/spreadsheets/d/10Eov7SGTLp6wuzmpSObIUyVkcn6K3jVh0rMAqe-Uego/gviz/tq?tqx=out:csv&sheet=Resumo%20Mensal';

Promise.all([
  fetch('data/meta-dashboard-data.json',{cache:'no-store'}).then(r=>r.json()),
  fetch('data/expo-dashboard-data.json',{cache:'no-store'}).then(r=>r.json())
]).then(async([m,e])=>{
  META=MidasMetaParser.normalizeMetaData(m);
  EXPO=e;
  try{
    const sheetData=await loadGoogleSheetSummary();
    META=MidasMetaParser.mergeMetaData(META,sheetData);
    window.__midasSheetOnline=true;
  }catch(error){
    console.warn('Google Sheets indisponível; usando base de segurança.',error);
    window.__midasSheetOnline=false;
  }
  init();
});

async function loadGoogleSheetSummary(){
  const response=await fetch(GOOGLE_SHEET_CSV,{cache:'no-store'});
  if(!response.ok)throw new Error('base não publicada');
  const csv=await response.text();
  if(!csv||csv.includes('<!DOCTYPE html>'))throw new Error('resposta inválida');
  const grid=parseCsv(csv);
  const headers=grid.shift()||[];
  const rows=grid.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
  const value=(row,name)=>row[name];
  const maybe=v=>String(v??'').trim()===''?null:MidasMetaParser.toNumber(v);
  const meses=rows.filter(row=>value(row,'Mês')).map(row=>({
    mes:value(row,'Mês'),chave:MidasMetaParser.monthKey(value(row,'Mês'))||String(value(row,'Chave')).trim(),
    investimento:maybe(value(row,'Investimento')),impressoes:maybe(value(row,'Impressões')),
    alcance:maybe(value(row,'Alcance')),cliques:maybe(value(row,'Cliques')),
    conversas:maybe(value(row,'Conversas')),cpa:maybe(value(row,'CPA')),
    ctr:maybe(value(row,'CTR')),cpc:maybe(value(row,'CPC')),cpm:maybe(value(row,'CPM')),
    frequencia:maybe(value(row,'Frequência')),seguidores:maybe(value(row,'Seguidores')),
    vendas:maybe(value(row,'Vendas')),leadsTrabalhados:maybe(value(row,'Leads trabalhados'))
  }));
  if(!meses.length)throw new Error('nenhum mês encontrado');
  return {meses,campanhas:[],idade:[],genero:[],insights:[],recomendacoes:[],sourceSheets:['Google Sheets']};
}

function parseCsv(text){
  const rows=[];
  let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}
      else quoted=!quoted;
    }else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((char==='\\n'||char==='\\r')&&!quoted){
      if(char==='\\r'&&text[i+1]==='\\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';
    }else cell+=char;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}

function refreshMonthSelect(selected){
  $('monthSelect').innerHTML=META.meses.map(m=>`<option value="${m.chave}">${m.mes}</option>`).join('');
  $('monthSelect').value=selected&&META.meses.some(m=>m.chave===selected)?selected:META.meses[META.meses.length-1].chave;
}

function init(){
  document.querySelectorAll('.module-tab').forEach(btn=>{
    btn.onclick=()=>switchPanel(btn.dataset.panel);
  });
  refreshMonthSelect();
  $('monthSelect').onchange=()=>renderMeta($('monthSelect').value);
  const sync=$('metaSyncStatus');
  if(sync){
    sync.classList.toggle('success',Boolean(window.__midasSheetOnline));
    sync.textContent=window.__midasSheetOnline?'● Sincronizado com Google Sheets':'● Base de segurança ativa';
  }
  $('expoUpload').onchange=e=>readExpoFile(e.target.files[0]);
  $('metaRefresh').onclick=()=>location.reload();
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
    $('mainTitle').textContent='MÍDIAS';
    $('mainSub').textContent='Performance de marketing e vendas';
    $('mainDesc').textContent='Visão executiva • Funil de performance • Resultado comercial';
  }else{
    $('mainTitle').textContent='DASHBOARD DA DIRETORIA';
    $('mainSub').textContent='SALA DE GUERRA';
    $('mainDesc').textContent='VISÃO EXECUTIVA • EXPOCONSTRUIR 2026';
  }
}

function renderMeta(key){
  const m=META.meses.find(x=>x.chave===key);
  if(!m)return;
  const prev=META.meses[META.meses.findIndex(x=>x.chave===key)-1];
  const campaigns=META.campanhas.filter(c=>c.mes===key).sort((a,b)=>b.conversas-a.conversas);

  $('executiveKpis').innerHTML=[
    ['💵','Vendas do mês',moneyMaybe(m.vendas),'Receita atribuída'],
    ['💰','Investimento',money(m.investimento),'Mídia no mês'],
    ['📈','ROI',pctMaybe(m.roi),'Retorno líquido'],
    ['🚀','ROAS',multipleMaybe(m.roas),'Receita por real']
  ].map(kpiCard).join('');

  $('channelKpis').innerHTML=[
    ['👁️','Impressões',number(m.impressoes),'Volume'],
    ['🔗','Cliques',number(m.cliques),'Acessos no link'],
    ['💬','Conversas',number(m.conversas),'WhatsApp'],
    ['🟠','CPA',money(m.cpa),'Custo por conversa'],
    ['📊','CTR',pct(m.ctr),'Taxa de clique'],
    ['🖱️','CPC',money(m.cpc),'Custo por clique']
  ].map(kpiCard).join('');

  $('commercialKpis').innerHTML=[
    ['🧲','Leads trabalhados',numberMaybe(m.leadsTrabalhados),'Comercial'],
    ['👤','Seguidores',numberMaybe(m.seguidores),'Audiência']
  ].map(kpiCard).join('');

  const salesMonths=META.meses.filter(item=>hasValue(item.vendas)).slice(-3);
  $('salesMonthCards').innerHTML=salesMonths.slice(-2).map(item=>`
    <article class="sales-month-card">
      <span>Vendas ${item.mes.split('/')[0]}</span>
      <b>${money(item.vendas)}</b>
      <small>Resultado registrado</small>
    </article>`).join('');

  $('monthMetrics').innerHTML=[
    ['💰','Investimento',money(m.investimento),'investimento',true],
    ['💵','Vendas',moneyMaybe(m.vendas),'vendas'],
    ['📈','ROI',pctMaybe(m.roi),'roi'],
    ['🚀','ROAS',multipleMaybe(m.roas),'roas'],
    ['🧲','Leads trabalhados',numberMaybe(m.leadsTrabalhados),'leadsTrabalhados'],
    ['👤','Seguidores',numberMaybe(m.seguidores),'seguidores'],
    ['👁️','Impressões',number(m.impressoes),'impressoes'],
    ['👥','Alcance',number(m.alcance),'alcance'],
    ['🔗','Cliques no link',number(m.cliques),'cliques'],
    ['🟢','Conversas iniciadas',number(m.conversas),'conversas'],
    ['🟠','Custo por conversa',money(m.cpa),'cpa',true],
    ['📊','CTR',pct(m.ctr),'ctr'],
    ['🖱️','CPC',money(m.cpc),'cpc',true],
    ['🎯','Frequência',Number(m.frequencia||0).toFixed(2).replace('.',','),'frequencia',true]
  ].map(row=>metricRow(row,prev)).join('');

  $('monthHighlight').innerHTML=hasValue(m.vendas)
    ?`🏆 <strong>Resultado comercial:</strong> ${money(m.vendas)} em vendas, ROAS de ${multipleMaybe(m.roas)} e ROI de ${pctMaybe(m.roi)}.`
    :`🏆 <strong>Destaque do mês:</strong> CPA de ${money(m.cpa)} com ${number(m.conversas)} conversas iniciadas. Vendas ainda não informadas.`;
  $('miniCompare').innerHTML=miniCompareTable();
  renderFunnel(m);
  renderCampaignTable(campaigns,m);
  renderRanking(campaigns);
  renderCompare();
  $('metaInsights').innerHTML=META.insights.map(x=>`<li>${x}</li>`).join('');
  $('metaRecommendations').innerHTML=META.recomendacoes.map(x=>`<li>${x}</li>`).join('');

  const chartMonths=META.meses.slice(-6);
  makeChart('mainBarChart','line',
    chartMonths.map(item=>item.mes.split('/')[0]),
    [
      {label:'Investimento',data:chartMonths.map(item=>item.investimento),borderColor:'#facc15',backgroundColor:'rgba(250,204,21,.10)',fill:true,tension:.38},
      {label:'Vendas',data:chartMonths.map(item=>hasValue(item.vendas)?item.vendas:null),borderColor:'#22d3ee',backgroundColor:'rgba(34,211,238,.12)',fill:true,tension:.38}
    ],
    false
  );

  const efficiencyBase=hasValue(m.vendas)&&m.vendas>0
    ?[Math.max(m.vendas-m.investimento,0),m.investimento]
    :[0,m.investimento||1];
  makeChart('efficiencyChart','doughnut',['Retorno','Investimento'],[{
    data:efficiencyBase,
    backgroundColor:['#22d3ee','#facc15'],
    borderColor:['rgba(34,211,238,.9)','rgba(250,204,21,.9)'],
    borderWidth:1
  }],true);
  $('efficiencyValue').innerHTML=`<b>${pctMaybe(m.roi)}</b><span>ROI</span>`;
  $('efficiencyAssessment').innerHTML=roiAssessment(m);

  makeChart('salesCompareChart','bar',
    salesMonths.map(item=>item.mes.split('/')[0]),
    [{label:'Vendas',data:salesMonths.map(item=>item.vendas),backgroundColor:['#1676c9','#1fa8e6','#22d3ee'],borderRadius:10}],
    false
  );

  const age=META.idade.filter(i=>i.mes===key);
  makeChart('ageChart','bar',age.map(i=>i.faixa),[{label:'CPA',data:age.map(i=>i.cpa),backgroundColor:['#22c55e','#facc15','#2563eb','#a855f7','#ef4444','#64748b']}],false);

  const gen=META.genero.filter(g=>g.mes===key);
  makeChart('genderChart','doughnut',gen.map(g=>g.nome),[{data:gen.map(g=>g.participacao),backgroundColor:['#2563eb','#ec4899','#64748b']}],true);
}

function roiAssessment(m){
  if(!hasValue(m.roi)||!hasValue(m.roas)){
    return `<b>Dados insuficientes</b><p>Informe as vendas do mês para avaliar o retorno.</p>`;
  }
  const roi=Number(m.roi);
  let status='Retorno baixo',tone='low';
  if(roi>=1000){status='Retorno excepcional';tone='exceptional';}
  else if(roi>=300){status='Retorno muito bom';tone='great';}
  else if(roi>=100){status='Retorno saudável';tone='good';}
  else if(roi>=0){status='Retorno positivo';tone='positive';}
  return `<div class="assessment-head ${tone}"><i></i><b>${status}</b></div>
    <p>Para cada R$ 1 investido, retornaram <strong>${multipleMaybe(m.roas)}</strong> em vendas.</p>
    <small>Leitura baseada em vendas atribuídas à mídia, não em lucro líquido.</small>`;
}

function kpiCard([icon,label,value,small]){
  return `<article class="kpi-card"><div class="icon">${icon}</div><span>${label}</span><b>${value}</b><small>${small}</small></article>`;
}

function metricRow([icon,label,value,field,invert],prev){
  const t=prev&&hasValue(value)&&hasValue(prev[field])?trend(valueToNumber(value),Number(prev[field]),invert):'';
  return `<div class="metric-row"><div class="mi">${icon}</div><div><span>${label}</span><b>${value}</b></div><small>${t}</small></div>`;
}

function valueToNumber(v){
  return MidasMetaParser.toNumber(String(v).replace(/x$/i,''))||0;
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
      ${hasValue(m.vendas)?`<div class="funnel-step"><span>Vendas do mês</span><b>${money(m.vendas)}</b></div>`:''}
    </div>
    <div class="funnel-note">
      Leitura correta: cliques são ${pct(clickRate)} das impressões; conversas são ${pct(convRate)} dos cliques.
      ${hasValue(m.vendas)
        ?`Retorno financeiro: ROAS de ${multipleMaybe(m.roas)} e ROI de ${pctMaybe(m.roi)}.`
        :'Informe a venda do mês na planilha para o dashboard calcular ROI e ROAS.'}
      Eficiência operacional: ${Number(m.roiOperacional||0).toFixed(3).replace('.',',')} conversas por real investido.
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
      ${compareLine('Vendas',moneyMaybe(m.vendas))}
      ${compareLine('ROI',pctMaybe(m.roi))}
      ${compareLine('ROAS',multipleMaybe(m.roas))}
      ${hasValue(m.leadsTrabalhados)?compareLine('Leads trabalhados',number(m.leadsTrabalhados)):''}
      <div class="compare-roi">ROAS ${multipleMaybe(m.roas)}<small>ROI ${pctMaybe(m.roi)}</small></div>
    </div>`).join('');
}

function compareLine(a,b){return `<div class="compare-line"><span>${a}</span><b>${b}</b></div>`}

function miniCompareTable(){
  return `<table class="table"><thead><tr><th>Indicador</th>${META.meses.slice(-3).map(m=>`<th>${m.mes.split('/')[0]}</th>`).join('')}</tr></thead>
    <tbody>
      ${['investimento','vendas','roi','roas','impressoes','cliques','conversas','cpa','ctr','cpc'].map(k=>`<tr><td>${label(k)}</td>${META.meses.slice(-3).map(m=>`<td>${format(k,m[k])}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
}

function label(k){return {investimento:'Invest.',vendas:'Vendas',roi:'ROI',roas:'ROAS',impressoes:'Impress.',cliques:'Cliques',conversas:'Conversas',cpa:'CPA',ctr:'CTR',cpc:'CPC'}[k]||k}
function format(k,v){
  if(!hasValue(v))return '–';
  if(['investimento','vendas','cpa','cpc'].includes(k))return money(v);
  if(['ctr','roi'].includes(k))return pct(v);
  if(k==='roas')return multipleMaybe(v);
  return number(v);
}

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
  const status=$('metaUploadStatus');
  status.className='upload-status';
  status.textContent='Lendo e validando a planilha...';
  try{
    const wb=await readWorkbook(file);
    const parsed=MidasMetaParser.parseMetaWorkbook(wb,XLSX);
    if(!parsed.meses.length)throw new Error('não encontrei uma aba mensal nem uma exportação válida do Meta Ads');
    META=MidasMetaParser.mergeMetaData(META,parsed);
    refreshMonthSelect(META.meses[META.meses.length-1].chave);
    renderMeta($('monthSelect').value);
    status.className='upload-status success';
    status.textContent=`Importado: ${parsed.meses.length} mês(es) • abas ${parsed.sourceSheets.join(', ')||'identificadas automaticamente'}.`;
    alert(`Planilha importada com sucesso!\n${parsed.meses.length} mês(es) reconhecido(s).\nVendas, ROI e ROAS foram atualizados.`);
  }catch(error){
    console.error(error);
    status.className='upload-status error';
    status.textContent=`Erro: ${error.message}`;
    alert(`Não consegui importar a planilha.\n${error.message}`);
  }finally{
    $('metaUpload').value='';
  }
}

async function readExpoFile(file){
  if(!file)return;
  const wb=await readWorkbook(file);
  EXPO=parseExpo(wb);
  renderExpo();
  alert('Planilha Sala de Guerra importada com sucesso!');
}

function readWorkbook(file){return file.arrayBuffer().then(b=>XLSX.read(b,{type:'array',cellDates:true}))}
function n(v){return MidasMetaParser.toNumber(v)||0}

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
