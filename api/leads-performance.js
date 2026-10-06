const LEADS_ENDPOINT='https://waves-performance-comercial.vercel.app/api/leads';
const MONTHS={JANEIRO:'01',FEVEREIRO:'02','MARÇO':'03',MARCO:'03',ABRIL:'04',MAIO:'05',JUNHO:'06',JULHO:'07',AGOSTO:'08',SETEMBRO:'09',OUTUBRO:'10',NOVEMBRO:'11',DEZEMBRO:'12'};

export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=600');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }
  try{
    const upstream=await fetch(LEADS_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    const payload=await upstream.json().catch(()=>({}));
    if(!upstream.ok||payload.success===false)throw new Error(payload.message||'Fonte de leads indisponível.');
    const year=new Date().getUTCFullYear();
    const grouped=new Map();
    for(const lead of payload.leads||[]){
      const name=String(lead.mes||'').trim().toUpperCase();
      const number=MONTHS[name];
      if(!number)continue;
      const key=`${year}-${number}`;
      if(!grouped.has(key))grouped.set(key,{chave:key,mes:name,leads:0,ganhos:0,vendas:0});
      const item=grouped.get(key);
      item.leads+=1;
      item.vendas+=Number(lead.valor||0);
      if(String(lead.etapa||'')==='✅ Ganho')item.ganhos+=1;
    }
    const months=[...grouped.values()].sort((a,b)=>a.chave.localeCompare(b.chave)).map(item=>({...item,vendas:Number(item.vendas.toFixed(2))}));
    return res.status(200).json({ok:true,source:'Dashboard Comercial · Leads',updatedAt:new Date().toISOString(),months});
  }catch(error){
    console.error('Leads performance proxy error:',error?.message||error);
    return res.status(502).json({ok:false,error:'Não foi possível consultar as vendas geradas pelos leads.'});
  }
}
