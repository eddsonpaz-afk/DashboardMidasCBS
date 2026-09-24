const LUCA_ENDPOINT='https://cbs-inteligencia-comercial.vercel.app/api/luca';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method==='GET'){
    try{
      const upstream=await fetch(LUCA_ENDPOINT,{headers:{Accept:'application/json'}});
      const data=await upstream.json().catch(()=>({}));
      return res.status(upstream.ok?200:502).json({ok:upstream.ok,provider:'Luca CBS',configured:Boolean(data.configured),model:data.model||null});
    }catch(error){
      return res.status(502).json({ok:false,error:'Luca CBS indisponível.'});
    }
  }
  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }
  const question=String(req.body?.question||'').trim().slice(0,2400);
  const context=req.body?.context&&typeof req.body.context==='object'?req.body.context:{};
  if(!question)return res.status(400).json({ok:false,error:'Digite uma pergunta.'});
  try{
    const upstream=await fetch(LUCA_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({
        question:`Você está analisando o Dashboard MÍDIAS da Waves Plus e CBS. ${question}`,
        context,
        history:[]
      })
    });
    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok||!data.answer)return res.status(upstream.status||502).json({ok:false,error:data.error||'Falha ao consultar o Luca.'});
    return res.status(200).json({ok:true,answer:data.answer,model:data.model||'Luca CBS',sheetUsed:Boolean(data.sheetUsed)});
  }catch(error){
    console.error('MÍDIAS AI proxy error:',error?.message||error);
    return res.status(502).json({ok:false,error:'Não foi possível consultar a IA agora.'});
  }
}
