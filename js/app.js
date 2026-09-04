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
let META, EXPO, FAIR_SALES=[], charts={};

const GOOGLE_SHEET_ID='10Eov7SGTLp6wuzmpSObIUyVkcn6K3jVh0rMAqe-Uego';

Promise.all([
  fetch('data/meta-dashboard-data.json',{cache:'no-store'}).then(r=>r.json()),
  fetch('data/expo-dashboard-data.json',{cache:'no-store'}).then(r=>r.json())
]).then(async([m,e])=>{
  META=MidasMetaParser.normalizeMetaData(m);
  EXPO=e;
  try{
    const sheetData=await loadGoogleSheetData();
    META=MidasMetaParser.mergeMetaData(META,sheetData);
    FAIR_SALES=sheetData.feiraVendas||[];
    window.__midasSheetOnline=true;
  }catch(error){
    console.warn('Google Sheets indisponível; usando base de segurança.',error);
    window.__midasSheetOnline=false;
  }
  init();
});

async function fetchGoogleSheetRows(sheet){
  const url=`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`aba ${sheet} não publicada`);
  const csv=await response.text();
  if(!csv||csv.includes('<!DOCTYPE html>'))throw new Error(`resposta inválida em ${sheet}`);
  const grid=parseCsv(csv);
  const headers=(grid.shift()||[]).map(header=>String(header).replace(/^\\uFEFF/,'').trim());
  return grid.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}

async function loadGoogleSheetData(){
  const [monthlyRows,campaignRows,ageRows,genderRows,fairRows]=await Promise.all([
    fetchGoogleSheetRows('Resumo Mensal'),fetchGoogleSheetRows('Campanhas'),
    fetchGoogleSheetRows('Idade'),fetchGoogleSheetRows('Gênero'),fetchGoogleSheetRows('Feiras')
  ]);
  const maybe=v=>String(v??'').trim()===''?null:MidasMetaParser.toNumber(v);
  const key=row=>MidasMetaParser.monthKey(row['Mês']||row['Chave'])||String(row['Chave']||'').trim();
  const meses=monthlyRows.filter(row=>row['Mês']).map(row=>({
    mes:row['Mês'],chave:key(row),investimento:maybe(row['Investimento']),
    impressoes:maybe(row['Impressões']),alcance:maybe(row['Alcance']),cliques:maybe(row['Cliques']),
    conversas:maybe(row['Conversas']),cpa:maybe(row['CPA']),ctr:maybe(row['CTR']),
    cpc:maybe(row['CPC']),cpm:maybe(row['CPM']),frequencia:maybe(row['Frequência']),
    seguidores:maybe(row['Seguidores']),vendas:maybe(row['Vendas']),leadsTrabalhados:maybe(row['Leads trabalhados'])
  }));
  const campanhas=campaignRows.filter(row=>row['Chave']&&row['Campanha']).map(row=>({
    mes:key(row),nome:row['Campanha'],investimento:maybe(row['Investimento'])||0,
    impressoes:maybe(row['Impressões'])||0,alcance:maybe(row['Alcance'])||0,
    cliques:maybe(row['Cliques'])||0,conversas:maybe(row['Conversas'])||0,
    cpa:maybe(row['CPA'])||0,ctr:maybe(row['CTR'])||0,cpc:maybe(row['CPC'])||0,cpm:maybe(row['CPM'])||0
  }));
  const idade=ageRows.filter(row=>row['Chave']&&row['Faixa etária']).map(row=>({
    mes:key(row),faixa:row['Faixa etária'],cpa:maybe(row['CPA'])||0,conversas:maybe(row['Conversas'])||0
  }));
  const genero=genderRows.filter(row=>row['Chave']&&row['Gênero']).map(row=>({
    mes:key(row),nome:row['Gênero'],participacao:maybe(row['Participação'])||0,cpa:maybe(row['CPA'])||0
  }));
  const feiraVendas=fairRows.filter(row=>row['Feira']&&row['Código do cliente']).map(row=>({
    feira:String(row['Feira']).trim(),
    codigo:String(row['Código do cliente']).trim(),
    cliente:String(row['Nome do cliente']||'Não informado').trim()||'Não informado',
    valor:maybe(row['Valor da venda'])||0
  }));
  if(!meses.length)throw new Error('nenhum mês encontrado');
  return {meses,campanhas,idade,genero,feiraVendas,sourceSheets:['Google Sheets']};
}

function parseCsv(text){
  const rows=[];
  let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],code=char.charCodeAt(0);
    if(char==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}
      else quoted=!quoted;
    }else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((code===10||code===13)&&!quoted){
      if(code===13&&text[i+1]?.charCodeAt(0)===10)i++;
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
  document.querySelectorAll('.fair-option').forEach(btn=>{
    btn.onclick=()=>selectFair(btn.dataset.fair);
  });
  updateFairSales();
  renderMeta($('monthSelect').value);
  renderExpo();
}

function switchPanel(panel){
  document.querySelectorAll('.module-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
  $('metaPanel').classList.toggle('hidden',panel!=='meta');
  $('warPanel').classList.toggle('hidden',panel!=='war');
  $('fairsPanel').classList.toggle('hidden',panel!=='fairs');
  if(panel==='meta'){
    $('mainTitle').textContent='MÍDIAS';
    $('mainSub').textContent='Performance de marketing e vendas';
    $('mainDesc').textContent='Visão executiva • Funil de performance • Resultado comercial';
  }else if(panel==='war'){
    $('mainTitle').textContent='DASHBOARD DA DIRETORIA';
    $('mainSub').textContent='SALA DE GUERRA';
    $('mainDesc').textContent='VISÃO EXECUTIVA • OPERAÇÃO COMERCIAL';
  }else{
    $('mainTitle').textContent='FEIRAS 2026';
    $('mainSub').textContent='INVESTIMENTO E RETORNO';
    $('mainDesc').textContent='CENÁRIOS • METAS • PIPELINE DE OPORTUNIDADES';
  }
}

function selectFair(fair){
  document.querySelectorAll('.fair-option').forEach(btn=>btn.classList.toggle('active',btn.dataset.fair===fair));
  $('feiconFair').classList.toggle('hidden',fair!=='feicon');
  $('expoconstruirFair').classList.toggle('hidden',fair!=='expoconstruir');
}

function formatInputMoney(value){
  return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function updateFairSales(){
  const investment=139271.10,targets=[250000,500000,1000000];
  const salesRows=FAIR_SALES.filter(item=>item.feira.toUpperCase().includes('EXPOCONSTRUIR'));
  const sales=salesRows.reduce((total,item)=>total+Number(item.valor||0),0);
  $('fairSalesInput').value=formatInputMoney(sales);
  const net=sales-investment;
  const roi=investment?net/investment*100:0;
  const ratio=investment?sales/investment:0;
  $('fairReturnSummary').innerHTML=`
    <div><small>Vendas acumuladas</small><b>${money(sales)}</b></div>
    <div class="${net>=0?'positive':''}"><small>Retorno após investimento</small><b>${money(net)}</b></div>
    <div class="${roi>=0?'positive':''}"><small>ROI da feira</small><b>${pct(roi)} • ${ratio.toFixed(2).replace('.',',')}x</b></div>`;
  const cards=[...document.querySelectorAll('[data-sales-target]')];
  let currentIndex=targets.findIndex(target=>sales<target);
  if(currentIndex<0)currentIndex=targets.length-1;
  cards.forEach((card,index)=>{
    const target=targets[index],gap=target-sales,reached=sales>=target;
    card.classList.toggle('reached',reached);
    card.classList.toggle('current',index===currentIndex);
    card.querySelector('.scenario-position').textContent=reached?'✓ NÍVEL ALCANÇADO':index===currentIndex?'VOCÊ ESTÁ AQUI':'PRÓXIMO NÍVEL';
    const footer=card.querySelector('footer');
    let gapEl=footer.querySelector('.scenario-gap');
    if(!gapEl){gapEl=document.createElement('span');gapEl.className='scenario-gap';footer.appendChild(gapEl);}
    gapEl.textContent=reached?`Superado em ${money(Math.abs(gap))}`:`Faltam ${money(gap)}`;
  });
  const progress=Math.min(sales/targets[2]*100,100);
  $('fairProgressBar').style.width=`${progress}%`;
  $('fairProgressLabel').textContent=`${pct(progress)} • faltam ${money(Math.max(targets[2]-sales,0))}`;
  $('fairSalesTable').innerHTML=`<table class="table">
    <thead><tr><th>Código</th><th>Nome do cliente</th><th>Valor da venda</th></tr></thead>
    <tbody>${salesRows.map(item=>`<tr><td>${item.codigo}</td><td>${item.cliente}</td><td>${money(item.valor)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total das vendas</td><td>${money(sales)}</td></tr></tfoot>
  </table>`;
  const next=targets.find(target=>sales<target);
  $('fairExecutiveAnalysis').innerHTML=net>=0
    ?`As vendas acumuladas são de <strong>${money(sales)}</strong>. Depois de descontar o investimento de <strong>${money(investment)}</strong>, o retorno é de <strong>${money(net)}</strong>, com ROI de <strong>${pct(roi)}</strong> e relação venda/investimento de <strong>${ratio.toFixed(2).replace('.',',')}x</strong>. ${next?`O próximo nível exige mais <strong>${money(next-sales)}</strong> em vendas.`:'A meta oficial foi alcançada.'}`
    :`As vendas acumuladas são de <strong>${money(sales)}</strong>. Ainda faltam <strong>${money(Math.abs(net))}</strong> para recuperar o investimento de <strong>${money(investment)}</strong>.`;
}

function renderMeta(key){
  const m=META.meses.find(x=>x.chave===key);
  if(!m)return;
  const prev=META.meses[META.meses.findIndex(x=>x.chave===key)-1];
  const campaigns=META.campanhas.filter(c=>c.mes===key).sort((a,b)=>b.conversas-a.conversas);

  $('executiveKpis').innerHTML=[
    ['💵','Vendas do mês',moneyMaybe(m.vendas),'Receita atribuída'],
    ['💰','Investimento',money(m.investimento),'Mídia no mês'],
    ['📈','ROI',pctMaybe(m.roi),roiCardDetail(m)],
    ['🚀','ROAS',multipleMaybe(m.roas),roasCardDetail(m)]
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
  renderStrategicCompare();
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

function roiCardDetail(m){
  if(!hasValue(m.roi))return 'Informe as vendas do mês';
  return `${money(Number(m.roi)/100)} de ganho além de cada R$ 1 investido`;
}

function roasCardDetail(m){
  if(!hasValue(m.roas))return 'Informe as vendas do mês';
  return `Cada R$ 1 em mídia gerou ${money(m.roas)} em vendas`;
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
    <p><strong>ROI de ${pctMaybe(m.roi)}:</strong> representa ${money(Number(m.roi)/100)} de ganho além de cada R$ 1 investido.</p>
    <p><strong>ROAS de ${multipleMaybe(m.roas)}:</strong> cada R$ 1 aplicado em mídia gerou ${money(m.roas)} em vendas.</p>
    <small>O ROI exibido é uma estimativa baseada nas vendas atribuídas e no investimento em mídia. O lucro líquido real exige custos, impostos e despesas operacionais.</small>`;
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

function renderStrategicCompare(){
  const months=META.meses.slice(-3);
  const previous=months[months.length-2],current=months[months.length-1];
  const specs=[
    ['👤','Seguidores','seguidores',numberMaybe,'higher'],
    ['💵','Vendas','vendas',moneyMaybe,'higher'],
    ['💰','Investimento','investimento',money,'neutral'],
    ['🧲','Leads trabalhados','leadsTrabalhados',numberMaybe,'higher'],
    ['👁️','Impressões','impressoes',number,'higher'],
    ['👥','Alcance','alcance',number,'higher'],
    ['📈','ROI','roi',pctMaybe,'higher'],
    ['🚀','ROAS','roas',multipleMaybe,'higher'],
    ['💬','Conversas','conversas',number,'higher'],
    ['🔗','Cliques','cliques',number,'higher'],
    ['🟠','CPA','cpa',money,'lower'],
    ['📊','CTR','ctr',pct,'higher'],
    ['🖱️','CPC','cpc',money,'lower']
  ];
  $('strategicCompareGrid').innerHTML=specs.map(([icon,label,field,formatter,goal])=>{
    const prevValue=previous?.[field],currValue=current?.[field];
    const delta=hasValue(prevValue)&&Number(prevValue)!==0&&hasValue(currValue)?(Number(currValue)-Number(prevValue))/Number(prevValue)*100:null;
    const readingClass=delta===null||goal==='neutral'?'neutral':goal==='lower'?(delta<=0?'positive':'negative'):(delta>=0?'positive':'negative');
    return `<article class="strategic-metric">
      <div class="strategic-metric-title"><span>${icon}</span><b>${label}</b></div>
      <div class="strategic-months">${months.map(m=>`<div><small>${m.mes.split('/')[0]}</small><strong>${formatter(m[field])}</strong></div>`).join('')}</div>
      <p class="strategic-reading ${readingClass}">${delta===null?'Sem base suficiente para calcular a variação.':`${delta>=0?'▲':'▼'} ${Math.abs(delta).toFixed(1).replace('.',',')}% de ${previous.mes.split('/')[0]} para ${current.mes.split('/')[0]}`}</p>
    </article>`;
  }).join('');
  if(previous&&current){
    const change=field=>hasValue(previous[field])&&Number(previous[field])!==0&&hasValue(current[field])?(Number(current[field])-Number(previous[field]))/Number(previous[field])*100:null;
    const followerDelta=change('seguidores'),salesDelta=change('vendas'),leadDelta=change('leadsTrabalhados');
    const impressionDelta=change('impressoes'),conversationDelta=change('conversas'),clickDelta=change('cliques'),cpaDelta=change('cpa');
    const part=(label,value,goodWord,badWord)=>value===null?`${label} sem base completa`:`${label} ${value>=0?goodWord:badWord} ${Math.abs(value).toFixed(1).replace('.',',')}%`;
    $('strategicAnalysis').innerHTML=`<b>Leitura de ${current.mes.split('/')[0]}:</b> ${part('a audiência',followerDelta,'cresceu','caiu')}; ${part('os leads',leadDelta,'cresceram','caíram')}; ${part('as conversas',conversationDelta,'cresceram','caíram')} e ${part('os cliques',clickDelta,'subiram','caíram')}. ${part('O CPA',cpaDelta,'subiu','caiu')} e ${part('as vendas',salesDelta,'cresceram','caíram')}. Mesmo abaixo do mês anterior, o ROI de ${pctMaybe(current.roi)} e o ROAS de ${multipleMaybe(current.roas)} continuam em nível excepcional.`;
  }
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
