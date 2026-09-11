const express=require("express");
const path=require("path");
const dotenv=require("dotenv");
const PDFDocument=require("pdfkit");
dotenv.config();
const app=express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const SYSTEM=`Você é o assistente da Arca Consultoria para uma calculadora trabalhista brasileira.
Explique de forma simples e objetiva. Use os dados do cálculo fornecidos pelo usuário.
Não invente lei, percentual ou direito. Diferencie a regra configurada no simulador de regras legais que possam exigir conferência.
Avise que o resultado é estimativo e pode depender de CCT/ACT, contrato, médias, adicionais, datas, estabilidade e descontos.`;

async function callGemini(question, calculation){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");
  const model=process.env.GEMINI_MODEL||"gemini-2.5-flash";
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body={contents:[{role:"user",parts:[{text:`${SYSTEM}\n\nCálculo:\n${calculation}\n\nPergunta:\n${question}`}]}]};
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await r.json(); if(!r.ok)throw new Error(j.error?.message||"Erro Gemini");
  return j.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"Sem resposta.";
}
async function callOpenRouter(question, calculation){
  if(!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY não configurada.");
  const model=process.env.OPENROUTER_MODEL||"openrouter/free";
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENROUTER_API_KEY}`,"X-Title":"Arca Consultoria"},
    body:JSON.stringify({model,messages:[{role:"system",content:SYSTEM},{role:"user",content:`Cálculo:\n${calculation}\n\nPergunta:\n${question}`}]})
  });
  const j=await r.json(); if(!r.ok)throw new Error(j.error?.message||"Erro OpenRouter");
  return j.choices?.[0]?.message?.content||"Sem resposta.";
}
async function callOllama(question, calculation){
  const base=process.env.OLLAMA_URL||"http://localhost:11434";
  const model=process.env.OLLAMA_MODEL||"gemma3";
  const r=await fetch(`${base}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model,messages:[{role:"system",content:SYSTEM},{role:"user",content:`Cálculo:\n${calculation}\n\nPergunta:\n${question}`}],stream:false})
  });
  const j=await r.json(); if(!r.ok)throw new Error(j.error||"Erro Ollama");
  return j.message?.content||"Sem resposta.";
}
app.post("/api/pdf",async(req,res)=>{
  try{
    const {cliente={},calculation:r={}}=req.body||{};
    const doc=new PDFDocument({size:"A4",margin:45});
    const chunks=[];
    doc.on("data",c=>chunks.push(c));
    doc.on("end",()=>{
      const pdf=Buffer.concat(chunks);
      res.setHeader("Content-Type","application/pdf");
      res.setHeader("Content-Disposition",'attachment; filename="Arca-Consultoria-Calculo-Trabalhista.pdf"');
      res.send(pdf);
    });
    const logo=path.join(__dirname,"public","arca-logo.png");
    if(require("fs").existsSync(logo)) doc.image(logo,45,35,{width:220,height:75,fit:[220,75]});
    doc.moveDown(5);
    doc.fillColor("#111111").fontSize(18).font("Helvetica-Bold").text("MEMÓRIA DE CÁLCULO TRABALHISTA");
    doc.moveDown(.4);
    doc.fillColor("#555555").fontSize(9).font("Helvetica").text("Arca Consultoria • Simulação estimativa");
    doc.moveDown(1);
    doc.fillColor("#111111").fontSize(11).font("Helvetica-Bold").text("DADOS DO CLIENTE");
    doc.font("Helvetica").fontSize(10).text(`Nome: ${cliente.nome||"Não informado"}`);
    doc.text(`CPF: ${cliente.cpf||"Não informado"}`);
    doc.text(`Data de nascimento: ${cliente.nascimento?new Date(cliente.nascimento+"T12:00:00").toLocaleDateString("pt-BR"):"Não informado"}`);
    doc.moveDown(.8);
    doc.font("Helvetica-Bold").text("DADOS DO CÁLCULO");
    const tipo=r.tipo==="demissao_empresa"?"Demissão sem justa causa — iniciativa da empresa":"Pedido de demissão";
    doc.font("Helvetica").text(`Salário base: ${money(r.salario)}`);
    doc.text(`Tipo: ${tipo}`);
    doc.text(`Aviso: ${r.aviso==="trabalhado"?"Trabalhado":"Indenizado"} (${r.avisoDias||30} dias)`);
    if(r.projObs)doc.text(r.projObs);
    doc.moveDown(.8);
    doc.font("Helvetica-Bold").text("VERBAS");
    const rows=[
      ["Saldo de salário",r.saldo],
      ["Aviso prévio indenizado",r.avisoRecebe],
      ["Desconto de aviso prévio",-(r.descontoAviso||0)],
      [`13º proporcional (${r.avos13||0}/12)`,r.dec13],
      [`Férias proporcionais (${r.avosFer||0}/12)`,r.ferProp],
      ["1/3 constitucional de férias",r.terco],
      ["Férias vencidas + 1/3",r.ferVencVal],
      ["Multa de 40% do FGTS",r.multa],
    ];
    rows.forEach(([label,val])=>{
      if(val) doc.font("Helvetica").text(`${label}: ${money(val)}`);
    });
    doc.moveDown(.8);
    doc.font("Helvetica-Bold").fontSize(14).text(`TOTAL ESTIMADO: ${money(r.total)}`);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#666666")
      .text("Observação: este documento é uma simulação. O cálculo oficial pode variar conforme legislação vigente, CCT/ACT, contrato, médias de parcelas variáveis, FGTS efetivamente recolhido, descontos e outras circunstâncias.");
    doc.end();
  }catch(e){res.status(500).json({error:e.message||"Falha ao gerar PDF"})}
});
function money(v){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0)}

app.post("/api/ai",async(req,res)=>{
  try{
    const {provider,question,calculation}=req.body||{};
    if(!question) return res.status(400).json({error:"Pergunta vazia."});
    let answer;
    if(provider==="gemini") answer=await callGemini(question,calculation);
    else if(provider==="ollama") answer=await callOllama(question,calculation);
    else answer=await callOpenRouter(question,calculation);
    res.json({answer});
  }catch(e){res.status(500).json({error:e.message||"Falha na IA."})}
});
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Arca Consultoria rodando em http://localhost:${port}`));
