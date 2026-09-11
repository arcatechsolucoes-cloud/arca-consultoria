const $=id=>document.getElementById(id);
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const parseDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const daysBetween=(a,b)=>Math.max(0,Math.floor((b-a)/86400000));
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmt=d=>d.toLocaleDateString('pt-BR');

function fullYears(adm,dem){let y=dem.getFullYear()-adm.getFullYear();const ann=new Date(dem.getFullYear(),adm.getMonth(),adm.getDate());if(dem<ann)y--;return Math.max(0,y)}
function monthsWith15(start,end){
  // Counts calendar months touched by the employment/projection interval
  let y=start.getFullYear(),m=start.getMonth(), out=0;
  while(new Date(y,m,1)<=end){
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    const from=first<start?start:first, to=last>end?end:last;
    const n=Math.floor((to-from)/86400000)+1;
    if(n>=15) out++;
    m++; if(m===12){m=0;y++}
  }
  return out;
}
function calc(){
  const salario=+$('salario').value||0, adm=parseDate($('admissao').value), dem=parseDate($('demissao').value);
  if(!salario||isNaN(adm)||isNaN(dem)||dem<adm){alert('Informe salário e datas válidas.');return null}
  const tipo=$('tipo').value, aviso=$('aviso').value, dias=Math.min(31,Math.max(0,+$('dias').value||0));
  const years=fullYears(adm,dem);
  let avisoDias=30;
  if(tipo==='demissao_empresa' && $('proporcional').checked) avisoDias=Math.min(90,30+3*years);
  let avisoValor=salario/30*avisoDias;
  let descontoAviso=0;
  if(tipo==='pedido_demissao' && aviso==='indenizado') descontoAviso=salario; // regra-base solicitada; acordos/dispensas podem alterar
  let fimFormal=dem, projFim=dem;
  if(aviso==='trabalhado') fimFormal=addDays(dem,30), projFim=fimFormal;
  else if(tipo==='demissao_empresa') {projFim=addDays(dem,avisoDias); fimFormal=dem}
  // For resignation, the employee does not receive indemnified notice; if not worked, deduction is modeled.
  const saldo=salario/30*dias;
  const avos13=monthsWith15(new Date(dem.getFullYear(),0,1),projFim);
  const dec13=salario/12*avos13;
  const avosFer=monthsWith15(adm,projFim)%12;
  const ferProp=salario/12*avosFer;
  const terco=ferProp/3;
  const ferVenc=+$('feriasVencidas').value||0;
  const ferVencVal=ferVenc*salario*(4/3);
  let fgtsBase;
  const fgtsReal=+$('fgtsReal').value||0;
  if(fgtsReal>0) fgtsBase=fgtsReal;
  else {
    const meses=Math.max(0,+$('mesesFgts').value||0);
    fgtsBase=meses*salario*0.08;
    // include estimated FGTS on 13th in a simple simulation
    fgtsBase+=dec13*0.08;
  }
  const multa=tipo==='demissao_empresa'?fgtsBase*.40:0;
  const fgtsSaque=tipo==='demissao_empresa'?fgtsBase:0;
  const total=saldo+dec13+ferProp+terco+ferVencVal+(tipo==='demissao_empresa'&&aviso==='indenizado'?avisoValor:0)+multa-descontoAviso;
  const avisoRecebe=(tipo==='demissao_empresa'&&aviso==='indenizado')?avisoValor:0;
  const projObs=aviso==='indenizado'&&tipo==='demissao_empresa'?`Projeção até ${fmt(projFim)} (${avisoDias} dias).`: 'Sem projeção indenizada.';
  return {salario,years,avisoDias,avisoValor,avisoRecebe,descontoAviso,dem,fimFormal,projFim,saldo,avos13,dec13,avosFer,ferProp,terco,ferVencVal,fgtsBase,multa,fgtsSaque,total,tipo,aviso,projObs};
}
function render(r){
  const label=r.tipo==='demissao_empresa'?'Demissão sem justa causa':'Pedido de demissão';
  $('resultado').className='result';
  $('resultado').innerHTML=`
  <div class="result-head"><div><b>${label}</b><div class="sub">${r.aviso==='trabalhado'?'Aviso trabalhado':'Aviso indenizado'} • ${r.avisoDias} dias considerados</div></div><div class="total">${brl(r.total)}</div></div>
  ${line('Saldo de salário',r.saldo)}
  ${r.avisoRecebe?line(`Aviso prévio indenizado (${r.avisoDias} dias)`,r.avisoRecebe):''}
  ${r.descontoAviso?line('Desconto de aviso prévio',-r.descontoAviso,true):''}
  ${line(`13º proporcional (${r.avos13}/12)`,r.dec13)}
  ${line(`Férias proporcionais (${r.avosFer}/12)`,r.ferProp)}
  ${line('1/3 constitucional de férias',r.terco)}
  ${r.ferVencVal?line('Férias vencidas + 1/3',r.ferVencVal):''}
  ${r.multa?line('Multa de 40% do FGTS',r.multa):''}
  <div class="line"><span><b>FGTS estimado/base</b><div class="sub">${$('fgtsReal').value?'base informada pelo usuário':'estimativa simples'}</div></span><span>${brl(r.fgtsBase)}</span></div>
  ${r.fgtsSaque?`<div class="line positive"><span>FGTS sujeito a saque (estimativa)</span><span>${brl(r.fgtsSaque)}</span></div>`:''}
  <p class="sub" style="margin-top:14px">${r.projObs} O valor acima é uma estimativa bruta; INSS, IRRF, médias de variáveis, adicionais, CCT/ACT, estabilidade, férias vencidas especiais e outras verbas podem alterar o resultado.</p>`;
}
function line(label,val,neg=false){return `<div class="line"><span>${label}</span><span class="${neg?'negative':''}">${brl(val)}</span></div>`}
let last=null;
const cpfField=$('clienteCpf');
cpfField.addEventListener('input',()=>{
  let v=cpfField.value.replace(/\D/g,'').slice(0,11);
  if(v.length>9)v=v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');
  else if(v.length>6)v=v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');
  else if(v.length>3)v=v.replace(/(\d{3})(\d{0,3})/,'$1.$2');
  cpfField.value=v;
});
$('calcular').onclick=()=>{last=calc();if(last){render(last);$('salvarPdf').disabled=false}};
$('tipo').onchange=()=>{if($('tipo').value==='pedido_demissao'){$('proporcional').checked=false;$('proporcional').disabled=true}else $('proporcional').disabled=false};
$('perguntar').onclick=async()=>{
  const q=$('pergunta').value.trim(); if(!q){alert('Digite sua dúvida.');return}
  const box=$('iaResposta');box.style.display='block';box.textContent='Consultando IA...';
  const calcResumo=last?JSON.stringify(last):'Nenhum cálculo foi executado ainda.';
  try{
    const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:$('provider').value,question:q,calculation:calcResumo})});
    const data=await res.json(); if(!res.ok)throw new Error(data.error||'Erro');
    box.textContent=data.answer;
  }catch(e){box.textContent='Não foi possível consultar a IA: '+e.message+'\\n\\nVocê pode conferir a configuração no arquivo .env e no README.'}
};

$('salvarPdf').onclick=async()=>{
  if(!last)return;
  const payload={
    cliente:{nome:$('clienteNome').value.trim(),cpf:$('clienteCpf').value.trim(),nascimento:$('clienteNascimento').value},
    calculation:last
  };
  const b=$('salvarPdf'); b.disabled=true; b.textContent='Gerando PDF...';
  try{
    const r=await fetch('/api/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok) throw new Error('Falha ao gerar PDF');
    const blob=await r.blob();
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='Arca-Consultoria-Calculo-Trabalhista.pdf'; a.click();
    URL.revokeObjectURL(url);
  }catch(e){alert(e.message)}
  finally{b.disabled=false;b.textContent='▣ Salvar cálculo em PDF'}
};
