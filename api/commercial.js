const INTELLIGENCE_ENDPOINT='https://cbs-inteligencia-comercial.vercel.app/api/intelligence';

const monthName=(month)=>['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][month-1];
const iso=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

async function loadMonth(year,month){
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  const upstream=await fetch(INTELLIGENCE_ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({filters:{startDate:iso(year,month,1),endDate:iso(year,month,lastDay)},refresh:false})
  });
  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok)throw new Error(data.error||`Falha ao consultar ${monthName(month)}`);
  const current=data.metrics?.current||{};
  const requestedEnd=data.filters?.endDate||iso(year,month,lastDay);
  const sourceEnd=data.dataRange?.end||requestedEnd;
  return {
    chave:`${year}-${String(month).padStart(2,'0')}`,
    mes:`${monthName(month)}/${year}`,
    pedido:Number(current.requested||0),
    atendido:Number(current.attended||0),
    faturado:Number(current.billed||0),
    clientes:Number(current.clients||0),
    pedidos:Number(current.orders||0),
    vendedores:Number(current.sellers||0),
    ticketMedio:Number(current.ticket||0),
    dataInicio:data.filters?.startDate||iso(year,month,1),
    dataFim:sourceEnd<requestedEnd?sourceEnd:requestedEnd
  };
}

export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }
  try{
    const now=new Date();
    const year=Number(req.query?.year)||now.getUTCFullYear();
    const lastMonth=year===now.getUTCFullYear()?now.getUTCMonth()+1:12;
    const months=[];
    for(let month=4;month<=lastMonth;month++)months.push([year,month]);
    const results=await Promise.all(months.map(([y,m])=>loadMonth(y,m)));
    return res.status(200).json({
      ok:true,
      source:'Google Sheets · BANCO1',
      updatedAt:new Date().toISOString(),
      months:results.filter(item=>item.pedido||item.atendido||item.faturado||item.pedidos)
    });
  }catch(error){
    console.error('BANCO1 proxy error:',error?.message||error);
    return res.status(502).json({ok:false,error:'Não foi possível consultar a aba BANCO1 agora.'});
  }
}
