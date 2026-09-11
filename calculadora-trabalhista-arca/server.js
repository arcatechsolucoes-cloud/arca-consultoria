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
    // Keep the supplied logo's original proportions in the PDF header.
    if(require("fs").existsSync(logo)) {
      doc.image(logo,45,35,{fit:[180,80]});
      doc.y=125;
    }
    doc.moveDown(.5);
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
    const tipos={demissao_empresa:"Demissão sem justa causa — iniciativa da empresa",pedido_demissao:"Pedido de demissão",acordo:"Rescisão por acordo entre as partes",justa_causa:"Demissão por justa causa",rescisao_indireta:"Rescisão indireta",fim_contrato:"Fim de contrato por prazo determinado"};
    const tipo=tipos[r.tipo]||"Modalidade não informada";
    doc.font("Helvetica").text(`Remuneração considerada: ${money(r.rem)}`);
    doc.text(`Tipo: ${tipo}`);
    doc.text(`Aviso: ${r.aviso==="trabalhado"?"Trabalhado":"Indenizado"} (${r.dias||30} dias)`);
    if(r.obs)doc.text(r.obs);
    doc.moveDown(.8);
    doc.font("Helvetica-Bold").text("VERBAS");
    const rows=[
      ["Saldo de salário",r.saldo],
      ["Aviso prévio indenizado",r.avisoVal],
      ["Desconto de aviso prévio",-(r.desconto||0)],
      [`13º proporcional (${r.a13||0}/12)`,r.d13],
      [`Férias proporcionais (${r.af||0}/12)`,r.fer],
      ["1/3 constitucional de férias",r.terco],
      ["Férias vencidas + 1/3",r.venc],
      ["Férias em dobro + 1/3",r.dobro],
      ["Multa de 40% do FGTS",r.multa],
      ["INSS estimado",-(r.inss||0)],
      ["Outros descontos",-(r.outros||0)],
    ];
    rows.forEach(([label,val])=>{
      if(val) doc.font("Helvetica").text(`${label}: ${money(val)}`);
    });
    doc.moveDown(.8);
    doc.font("Helvetica-Bold").fontSize(14).text(`TOTAL LÍQUIDO ESTIMADO: ${money(r.total)}`);
    doc.font("Helvetica").fontSize(10).text(`FGTS disponível para saque (se aplicável): ${money(r.saque)}`);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#666666")
      .text("Observação: este documento é uma simulação. O cálculo oficial pode variar conforme legislação vigente, CCT/ACT, contrato, médias de parcelas variáveis, FGTS efetivamente recolhido, descontos e outras circunstâncias.");
    doc.font("Helvetica").fontSize(8).fillColor("#666666")
      .text("Arca Consultoria - Fone/WhatsApp: 22 99279-8906",45,795,{width:505,align:"center"});
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
