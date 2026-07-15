# Verbo & Canção

Apreciação e validação de letras musicais — teologia, português e composição, lado a lado
com a voz autoral do compositor. Esta versão é **livre, sem login e sem senha**: qualquer pessoa
pode colar uma letra e receber uma análise estruturada. Não há upload de áudio nesta fase — apenas
texto.

## O que foi construído

Um monorepo com três pacotes npm workspaces:

- `shared/` — schemas Zod que definem todo o contrato de dados (achados, referências bíblicas,
  afirmações teológicas, prosódia, relatório final...). Usado tanto pelo servidor quanto pelo
  front-end, então uma resposta que não bate com o schema nunca chega à tela.
- `server/` — API Express em TypeScript. Faz checagens gramaticais determinísticas (sem IA),
  divisão de seções, estimativa de prosódia, consulta a um pequeno banco de versículos de domínio
  público, e a chamada estruturada ao modelo de IA (Anthropic Claude, com *tool use* forçando
  saída em JSON validado). Sem uma chave de API configurada, roda em **modo demonstração**.
- `web/` — SPA em React + TypeScript + Vite + Tailwind, PWA instalável, tema claro/escuro,
  mobile-first. Sem contas de usuário: tudo fica salvo em `localStorage` no navegador.

### Fluxo de análise (arquitetura em etapas, não uma única chamada de IA)

1. **Preparação** — a letra é dividida em seções (manual ou por heurística de repetição/rótulos
   explícitos como "Refrão", "Verso 2"...).
2. **Checagens determinísticas** — espaçamento, pontuação duplicada, repetição involuntária de
   palavras, pleonasmos e cacofonias conhecidas, linhas muito longas. Nunca usa IA — é regex e
   dicionário, então nunca alucina.
3. **Prosódia** — contagem aproximada de sílabas poéticas por linha (grupos vocálicos + elisão
   entre palavras), sempre rotulada como estimativa textual, nunca com base em melodia.
4. **Análise de IA** — uma única chamada ao Claude com *tool use* forçado, retornando um objeto
   JSON que cobre visão geral, referências bíblicas, contexto bíblico, afirmações teológicas,
   coerência narrativa, composição, refrão, rimas, emoção/estilo, adequação congregacional,
   perguntas ao compositor e sugestões — tudo validado contra o schema Zod, com uma tentativa de
   reparo automático se a primeira resposta não bater com o schema.
5. **Reforço contra alucinação bíblica** — o modelo é instruído a *nunca* escrever o texto de um
   versículo. Mesmo que escrevesse, o servidor descarta qualquer texto bíblico vindo da IA e só
   preenche o campo `verseText` a partir de uma consulta real a um pequeno dataset curado de
   versículos de domínio público. Referência fora desse conjunto → mostra só a referência e a
   explicação, nunca um texto inventado.

## Como executar localmente

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install               # instala as três workspaces
npm run dev                # sobe o servidor (porta 8787) e o front-end (porta 5173) juntos
```

Abra `http://localhost:5173`. Sem `ANTHROPIC_API_KEY` configurada, a análise roda em modo
demonstração — funciona de ponta a ponta, mas o conteúdo da análise é um exemplo fixo, claramente
identificado como tal na tela.

### Configurar a API de IA (opcional, para análises reais)

```bash
cp server/.env.example server/.env
# edite server/.env e defina:
# ANTHROPIC_API_KEY=sk-ant-...
```

Reinicie `npm run dev`. O rodapé "Sobre" e o cabeçalho da análise deixam claro quando o app está em
modo demonstração vs. modo real (`GET /api/health` também informa isso em `{ mode: "live" | "demo" }`).

### Comandos úteis

```bash
npm run build       # build de produção dos três pacotes
npm run lint        # eslint em server/ e web/
npm run typecheck   # tsc --noEmit nos três pacotes
npm run test        # vitest nos três pacotes (55 testes)
```

## Publicação

- **Front-end (`web/`)**: `npm run build -w web` gera `web/dist/`, publicável em qualquer host
  estático (Cloudflare Pages, Vercel, Netlify...). Configure o proxy/rewrite de `/api/*` para
  apontar para onde o back-end estiver publicado (em dev, o Vite já faz isso via `vite.config.ts`).
- **Back-end (`server/`)**: `npm run build -w server` gera `server/dist/`, executável com
  `node dist/index.js` em qualquer ambiente Node (Cloudflare Workers exigiria adaptar o Express
  para o runtime de Workers — não foi feito nesta fase; ver "Limitações"). Defina
  `ANTHROPIC_API_KEY`, `PORT` e `CORS_ORIGIN` como variáveis de ambiente do host.

## O que já funciona

- Onboarding explicando o que o sistema faz e não faz.
- Criação de composição sem nenhum campo obrigatório além da letra.
- Formulário de intenção/contexto completo (mensagem, tradição teológica, contexto de uso etc.),
  totalmente opcional.
- Editor de letra com sugestão automática de seções (verso/refrão/ponte...), corrigível pelo
  usuário; o texto original nunca é alterado pela análise.
- Análise completa em abas: Visão geral, Letra destacada, Bíblia & Teologia, Mensagem &
  Coerência, Português, Composição, Congregacional, Sugestões, Perguntas, Relatório.
- Destaques coloridos na letra ligados a cada achado, com botões aceitar/ignorar (a decisão fica
  salva na versão, no navegador).
- Histórico de versões por composição, duplicação de versão, comparação lado a lado com diff de
  palavras e uma tabela de dimensões objetivas — sem declarar automaticamente qual versão é
  "melhor".
- Exportação do relatório final em `.txt`, `.docx`, `.pdf` e cópia para a área de transferência.
- Tema claro/escuro, PWA instalável, layout mobile-first.
- 55 testes automatizados (schemas, checagens determinísticas, seções, prosódia, banco bíblico,
  proteção contra alucinação, injeção de prompt na letra, rotas HTTP, store e componentes React).

## Limitações reais

- **Sem áudio.** Nenhuma análise de melodia, BPM, tonalidade ou extensão vocal existe nesta fase —
  a arquitetura (schemas, adaptadores) está desenhada para não impedir isso no futuro, mas nada
  disso foi implementado.
- **Bíblia**: o dataset de versículos com texto disponível é pequeno (~45 versículos muito
  conhecidos, transcritos da tradução histórica Almeida de domínio público) — não é uma Bíblia
  completa, e a redação pode diferir de edições registradas modernas (ARC/ACF/NVI/NAA da SBB).
  Referências fora desse conjunto aparecem sem o texto do versículo.
- **Sem persistência em nuvem.** Tudo fica em `localStorage`; limpar dados do navegador ou trocar
  de dispositivo apaga o histórico. Não há link privado com expiração (mencionado no prompt
  original) — para compartilhar, exporte um arquivo.
- **Sem login intencionalmente.** Isso significa que não há isolamento por usuário no servidor:
  qualquer um com acesso à URL pública pode enviar letras para análise. Adequado para uso pessoal
  ou demonstração; não recomendado como serviço multiusuário sem adicionar autenticação e limites
  de uso.
- **Servidor não é Cloudflare Worker nativo.** É Express/Node puro; funciona em qualquer host Node,
  mas precisaria de adaptação para rodar como Worker de borda.
- **Sem análise gramatical determinística de terceiros** (ex.: LanguageTool) — a camada
  determinística é um conjunto de regras próprias (repetição, pontuação, pleonasmos, cacofonias
  conhecidas); concordância/regência/conjugação ficam a cargo do modelo de IA, sempre com o trecho
  citado.

## Roadmap (segunda fase, não implementada)

Upload/gravação de áudio, detecção de BPM e tonalidade, comparação entre emoção da letra e do
áudio, extensão vocal e sugestão de transposição, importação de cifras, comentários colaborativos,
compartilhamento com produtor/pastor/coautor, tradução bíblica selecionável entre múltiplas
licenças oficiais (YouVersion/API.Bible) além do conjunto de domínio público atual.
