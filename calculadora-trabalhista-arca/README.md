# Arca Consultoria — Calculadora Trabalhista

## O que esta versão já faz
- Cadastro do cliente: nome completo, CPF e data de nascimento.
- Logo Arca Consultoria na interface.
- Exportação do cálculo para PDF com a logo e identificação do cliente.
- Demissão sem justa causa por iniciativa da empresa.
- Pedido de demissão.
- Aviso trabalhado.
- Aviso indenizado.
- Regra de 30 dias conforme a configuração solicitada.
- Opção de aviso proporcional legal (30 a 90 dias) para demissão pela empresa.
- Saldo de salário.
- 13º proporcional.
- Férias proporcionais + 1/3.
- Férias vencidas + 1/3 (quantidade informada).
- FGTS estimado ou base de FGTS informada manualmente.
- Multa de 40% do FGTS na demissão sem justa causa.
- Estimativa do FGTS sujeito a saque na demissão sem justa causa.
- Assistente de IA com OpenRouter, Gemini ou Ollama.
- Chaves de IA ficam no servidor, não no navegador.

## Instalação
1. Instale Node.js 20+.
2. Na pasta do projeto:
   npm install
3. Copie `.env.example` para `.env`.
4. Configure pelo menos um provedor de IA.
5. Execute:
   npm start
6. Abra:
   http://localhost:3000

## IA gratuita
### OpenRouter
Use `OPENROUTER_API_KEY` e mantenha `OPENROUTER_MODEL=openrouter/free`.
O OpenRouter informa uma rota de modelos gratuitos, sujeita a disponibilidade e limites.

### Google Gemini
Crie uma chave para a Gemini API/AI Studio e preencha `GEMINI_API_KEY`.
A disponibilidade da camada gratuita e os limites dependem dos modelos/conta.

### Ollama
É a opção mais interessante para privacidade/local. Instale Ollama no computador e baixe um modelo, por exemplo:
   ollama pull gemma3
Depois deixe `OLLAMA_URL=http://localhost:11434`.

## Importante sobre o cálculo
Esta é uma calculadora de estimativa. A legislação trabalhista brasileira possui detalhes que não cabem em uma única fórmula: aviso prévio proporcional, médias de parcelas variáveis, adicionais, férias vencidas e em dobro, estabilidade, CCT/ACT, data-base, descontos, INSS, IRRF, FGTS efetivamente recolhido, entre outros.

O simulador usa 15 dias ou mais como mês/avo para 13º e férias, conforme a regra configurada no projeto.

A multa de FGTS é simulada como 40% da base de FGTS. Se o saldo real de FGTS estiver disponível, informe-o para melhorar a estimativa; ainda assim, o cálculo oficial deve ser conferido com os extratos e regras aplicáveis.

## Próxima versão recomendada
- INSS e IRRF.
- Médias de horas extras/adicionais/comissões.
- Férias vencidas com tratamento específico.
- FGTS mês a mês.
- Exportação PDF.
- Histórico de cálculos.
- Login de usuário.
- Cadastro de empresas/clientes.
- CCT/ACT por categoria.
- Motor de regras separado da interface.
- Auditoria da memória de cálculo.
- Banco de dados.

## Publicação no Render

Este projeto já contém `render.yaml` para facilitar a criação do Web Service no Render.

### Pelo painel
1. Crie uma conta no Render.
2. Coloque este projeto em um repositório GitHub.
3. No Render, escolha **New → Blueprint**.
4. Conecte o repositório.
5. O Render encontrará o `render.yaml`.
6. Escolha o plano **Free**.
7. Em Environment/Environment Variables, informe pelo menos uma chave de IA se quiser usar o assistente.
8. Clique em **Apply/Deploy Blueprint**.
9. Aguarde o build.
10. Abra a URL `*.onrender.com`.

### Configuração
Build Command: `npm install`
Start Command: `npm start`
Health Check: `/`

O servidor já usa a variável `PORT` fornecida pelo Render.

### Atenção sobre armazenamento
A versão atual não salva clientes/histórico em banco. O cadastro é usado durante o cálculo e o PDF. Não use armazenamento local para dados permanentes no plano gratuito: o filesystem do serviço é efêmero. Quando evoluirmos para histórico de clientes, vamos adicionar Supabase/PostgreSQL.

### Segurança
Nunca coloque chaves de IA no código, no GitHub ou no navegador. No Render, use Environment Variables/Secrets.
