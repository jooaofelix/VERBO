# Verbo & Canção

Apreciação e validação de letras musicais — teologia, português e composição, lado a lado
com a voz autoral do compositor. Esta versão é 100% gratuita para operar: front-end e IA rodam
inteiramente no **Cloudflare** (Pages + Workers AI, sem chave de API paga), e o único dado
persistente vive no **Firebase** (Authentication + Cloud Firestore, plano Spark/gratuito).

## Arquitetura

Um monorepo com três pacotes npm workspaces:

- **`shared/`** — schemas Zod que definem todo o contrato de dados (achados, referências bíblicas,
  afirmações teológicas, prosódia, relatório final...). Usado tanto pelo Worker quanto pelo
  front-end, então uma resposta que não bate com o schema nunca chega à tela nem ao banco.
- **`worker/`** — um único **Cloudflare Worker** (`fetch` handler HTTP simples, sem framework),
  responsável apenas por rodar a análise de IA. Ele **verifica o Firebase ID Token do cliente
  sozinho**, usando somente Web Crypto (`crypto.subtle`) contra as chaves públicas do Google — não
  depende do `firebase-admin` nem de nenhuma chamada de rede além de buscar/cachear o JWKS. Depois
  de validar o token, roda a análise com o binding de **Workers AI** (`env.AI`). O Worker **nunca
  acessa o Firestore** — ele é totalmente stateless, recebe a letra no corpo da requisição e
  devolve o resultado; quem grava no banco é sempre o próprio cliente autenticado.
- **`web/`** — SPA em React + TypeScript + Vite + Tailwind, PWA instalável, tema claro/escuro,
  mobile-first. Publicada como arquivos estáticos no **Cloudflare Pages**.

Bancos e serviços:

- **Firebase Authentication** — Google, e-mail/senha (com recuperação de senha) e modo
  demonstração via conta anônima (isolada por UID como qualquer outra conta).
- **Cloud Firestore** — única fonte de dados persistente para usuários, composições, versões,
  análises, relatórios e configurações. Sem localStorage, sem D1, sem KV, sem R2.
- **Cloudflare Workers AI** — único provedor de IA, através do binding nativo `env.AI` (modelo
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Não existe chave de API de IA nesta versão: o
  binding é configurado inteiramente no `wrangler.jsonc` e provisionado pela própria Cloudflare.

Esta versão **não usa Firebase Cloud Functions nem Firebase Storage** — não há upload de áudio,
PDF ou DOCX, e nenhuma lógica de servidor roda dentro do ecossistema Firebase.

### Estrutura do Firestore

```
users/{userId}                                      perfil do usuário
users/{userId}/songs/{songId}                       composição (título, autor...)
users/{userId}/songs/{songId}/versions/{versionId}  letra, seções, contexto, análise atual
users/{userId}/songs/{songId}/analyses/{analysisId} resultado da análise (gravado pelo próprio cliente)
users/{userId}/songs/{songId}/references/{referenceId} referências bíblicas salvas pelo usuário
users/{userId}/songs/{songId}/comments/{commentId}  comentários
users/{userId}/settings/{documentId}                preferências do usuário
users/{userId}/reports/{reportId}                   relatórios finais gerados (client-side)
```

`firestore.rules` é a **única** camada de isolamento entre contas, já que não existe mais um
servidor confiável com Admin SDK: cada leitura/escrita fica restrita ao próprio UID autenticado,
ninguém pode gravar um `userId` diferente do seu, e `title`/`lyrics` respeitam limites de tamanho.
O Worker não participa desse isolamento — ele só confirma *quem* está fazendo a requisição
(identidade), não *o que* essa pessoa pode gravar no banco (isso é 100% responsabilidade das
rules).

### Fluxo de análise

1. O front-end salva a letra como uma `SongVersion` no Firestore (autosave com debounce),
   diretamente pelo SDK do cliente.
2. O front-end pega o **Firebase ID Token** do usuário logado (`user.getIdToken()`) e chama
   `POST /analyze` no Worker, com a letra no corpo e o token no header `Authorization: Bearer`.
3. O Worker verifica a assinatura RS256 do token contra o JWKS público do Google (com cache
   respeitando o `Cache-Control` da resposta), confirma `iss`/`aud`/`exp`/`iat`/`auth_time`, e só
   então aceita a requisição. Aplica também um limite de tamanho de texto e um limite de chamadas
   por hora por UID (em memória, por isolate — melhor esforço, não durável, já que não há D1/KV/R2
   nesta versão).
4. Rodam checagens determinísticas de português (regex/dicionário — nunca alucinam) e uma
   estimativa de prosódia (sílabas por linha), sempre calculadas no próprio Worker, nunca pela IA.
5. Uma única chamada ao binding `env.AI` (Workers AI) retorna um JSON coerente com o schema Zod
   (visão geral, referências bíblicas, teologia, coerência narrativa, composição, refrão, rimas,
   emoção, adequação congregacional, perguntas, sugestões). Se a resposta não bater com o schema,
   há uma tentativa automática de reparo antes de desistir. Sem o binding de IA disponível (por
   exemplo, rodando `wrangler dev` localmente sem `--remote`), a análise cai automaticamente em
   **modo demonstração**.
6. Toda referência bíblica que o modelo identificar é cruzada com um pequeno dataset curado de
   versículos de domínio público — o texto do versículo só aparece se estiver nesse dataset; a IA
   é instruída a nunca escrever o texto bíblico, e mesmo que escrevesse, o Worker descarta e
   substitui pelo resultado dessa consulta.
7. O Worker devolve o resultado já validado contra o schema; o **front-end grava** o resultado em
   `users/{uid}/songs/{songId}/analyses/{analysisId}` e atualiza a versão correspondente, num único
   `writeBatch` — nunca uma resposta inválida chega ao Firestore, e nunca é o Worker quem escreve.

## Como executar localmente

Pré-requisitos: Node.js 20+, npm, e o Firebase CLI (`npm install -g firebase-tools` ou use o que
já vem como devDependency do projeto via `npx firebase`). Java é necessário apenas para rodar os
emuladores de Auth/Firestore localmente.

```bash
npm install                 # instala as três workspaces (shared/worker/web)
```

### Opção A — contra um projeto Firebase real

```bash
cp web/.env.example web/.env
# preencha web/.env com as credenciais do seu projeto Firebase (veja "Configurar o Firebase" abaixo)
# defina VITE_WORKER_URL=http://127.0.0.1:8787 para apontar para o Worker local

npm run dev                 # builda shared, sobe `wrangler dev` (Worker) + o Vite dev server
```

Sem `--remote` no `wrangler dev`, o binding `env.AI` não fica disponível localmente — as análises
rodam automaticamente em **modo demonstração**: a resposta tem a mesma estrutura de uma análise
real, mas o conteúdo é um exemplo fixo, claramente identificado como tal. Para testar o binding de
verdade em desenvolvimento, use `wrangler dev --remote` dentro de `worker/`.

### Opção B — inteiramente contra o Firebase Emulator Suite (sem projeto real)

```bash
cp web/.env.example web/.env
# em web/.env, defina VITE_USE_FIREBASE_EMULATORS=true
# os demais VITE_FIREBASE_* podem ficar com qualquer valor de exemplo

npm run emulators            # sobe auth+firestore localmente
npm run dev -w worker         # em outro terminal
npm run dev -w web            # em outro terminal
```

### Comandos úteis

```bash
npm run build         # build de produção: shared, worker (typecheck) e web
npm run lint          # eslint em worker/ e web/
npm run typecheck     # tsc --noEmit nos três pacotes
npm run test          # vitest nos três pacotes
npm run test:rules    # testes de firestore.rules no Firebase Emulator Suite
npm run test:e2e      # smoke test ponta a ponta: login, salvar, chamar o Worker, salvar análise
npm run emulators     # sobe o Firebase Emulator Suite (auth, firestore, UI)
```

## Configurar o Firebase (console)

1. Crie um projeto chamado `verbo-cancao-free` em
   [console.firebase.google.com](https://console.firebase.google.com) (plano **Spark**, gratuito —
   nenhum recurso desta versão exige o plano Blaze).
2. **Authentication** → Sign-in method → ative **E-mail/senha** e **Google**. Ative também
   **Anônimo**, para o modo demonstração.
3. **Firestore Database** → crie o banco (modo produção). As regras deste repositório
   (`firestore.rules`) já cobrem o isolamento por usuário — publique-as no passo de deploy abaixo.
4. Em **Configurações do projeto → Seus apps**, crie um app Web e copie as credenciais para
   `web/.env` (veja `web/.env.example` — nenhum desses valores é secreto, eles só identificam o
   projeto; a segurança real vem das rules).
5. `.firebaserc` já aponta para `verbo-cancao-free` como projeto padrão; ajuste se você usar outro
   nome de projeto.

## Configurar o Cloudflare

1. Crie uma conta Cloudflare (gratuita) se ainda não tiver.
2. Em **Workers & Pages**, confirme que **Workers AI** está disponível para a conta (incluído no
   plano gratuito, com limite diário de requisições neurais).
3. Dentro de `worker/`, rode `npx wrangler login` uma vez para autenticar a CLI localmente.
4. O binding `AI` já está declarado em `worker/wrangler.jsonc` — nenhuma configuração adicional é
   necessária no dashboard para o binding funcionar após o deploy.

## Publicação

**Backend de IA → Cloudflare Worker:**

```bash
cd worker
npx wrangler deploy
```

**Frontend → Cloudflare Pages:**

```bash
npm run build -w web
# publique web/dist/ no Cloudflare Pages (via dashboard ou `npx wrangler pages deploy web/dist`)
```

**Banco + auth → Firebase:**

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Parâmetros exatos do Cloudflare Pages (projeto do frontend)

| Campo | Valor |
|---|---|
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command (alternativa via CLI) | `npx wrangler pages deploy dist` (executado dentro de `web/`) |

### Parâmetros exatos do Cloudflare Worker (backend de IA)

| Campo | Valor |
|---|---|
| Root directory | `worker` |
| Build command | não há build separado — `npx wrangler deploy` compila e publica em um único passo |
| Deploy command | `npx wrangler deploy` (executado dentro de `worker/`) |

### Variáveis de ambiente necessárias

**Cloudflare Pages (projeto do frontend, `web/`)** — variáveis `VITE_*` configuradas em
Settings → Environment variables do projeto Pages:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_WORKER_URL` — URL pública do Worker publicado (ex.:
  `https://verbo-cancao-worker.<sua-subdomain>.workers.dev`)
- `VITE_USE_FIREBASE_EMULATORS` — opcional, `false`/omitida em produção

**Cloudflare Worker (`worker/wrangler.jsonc`, seção `vars`)**:

- `FIREBASE_PROJECT_ID` — o `projectId` do projeto Firebase (`verbo-cancao-free`), usado para
  validar o campo `aud` do ID Token
- `ALLOWED_ORIGIN` — origem permitida em CORS (URL do site publicado no Cloudflare Pages, ou `*`
  em desenvolvimento)

Nenhuma chave de API de IA é necessária em nenhum lugar — o binding `AI` do `wrangler.jsonc`
provê acesso ao Workers AI diretamente, sem secret. Não há `ANTHROPIC_API_KEY` nesta versão.

## Funcionamento offline

O Firestore mantém cache local (IndexedDB) no navegador. Com isso, o usuário consegue visualizar
dados já carregados e continuar editando uma letra sem internet; as alterações sincronizam
automaticamente quando a conexão retorna. O indicador de salvamento na tela de edição mostra os
estados **salvo / salvando / offline / sincronizando / erro ao salvar**. Rodar uma análise sempre
exige conexão, já que depende do Worker.

## O que já funciona

- Login com Google, e-mail/senha (com recuperação de senha) e modo demonstração anônimo; todas as
  páginas internas exigem autenticação.
- Isolamento por usuário garantido inteiramente por `firestore.rules` (não há mais uma segunda
  camada de servidor confiável, já que o Worker não toca no Firestore).
- Criação de composição sem nenhum campo obrigatório além da letra.
- Formulário de intenção/contexto completo (mensagem, tradição teológica, contexto de uso etc.),
  totalmente opcional.
- Editor de letra com sugestão automática de seções (verso/refrão/ponte...) via Worker, corrigível
  pelo usuário; autosave com debounce e indicador de estado de salvamento; o texto original nunca
  é alterado silenciosamente.
- Análise completa em abas: Visão geral, Letra destacada, Bíblia & Teologia, Mensagem &
  Coerência, Português, Composição, Congregacional, Sugestões, Perguntas, Relatório.
- Destaques coloridos na letra ligados a cada achado, com botões aceitar/ignorar (a decisão fica
  salva na versão, no Firestore).
- Histórico de versões por composição, duplicação de versão, comparação lado a lado (diff de
  palavras calculado inteiramente no cliente) com uma tabela de dimensões objetivas — sem declarar
  automaticamente qual versão é "melhor".
- Exportação do relatório final (montado inteiramente no cliente a partir da análise já salva) em
  `.txt`, `.docx`, `.pdf`, e cópia para a área de transferência.
- Tema claro/escuro, PWA instalável, layout mobile-first.
- Testes unitários (schemas, checagens determinísticas, seções, prosódia, banco bíblico, proteção
  contra alucinação, verificação de ID Token via Web Crypto, provider de Workers AI, rotas HTTP do
  Worker), testes de regras de segurança rodando no Firebase Emulator Suite, e um smoke test ponta
  a ponta cobrindo login, isolamento por usuário, salvamento e chamada real ao Worker.

## Limitações reais

- **Sem áudio, PDF ou DOCX de entrada.** Esta versão analisa apenas texto colado/digitado — não há
  upload de arquivos em nenhuma tela.
- **Bíblia**: o dataset de versículos com texto disponível é pequeno (~45 versículos muito
  conhecidos, transcritos da tradução histórica Almeida de domínio público) — não é uma Bíblia
  completa, e a redação pode diferir de edições registradas modernas (ARC/ACF/NVI/NAA da SBB).
  Referências fora desse conjunto aparecem sem o texto do versículo.
- **Conta anônima (modo demonstração)** não pode ser recuperada em outro dispositivo ou navegador
  — é uma sessão isolada, não uma conta portátil.
- **Limite de chamadas por hora** é aplicado em memória, por isolate do Worker — não é durável nem
  compartilhado entre isolates/regiões (não há D1/KV/R2 nesta versão), então é um limite de
  melhor esforço, não uma garantia rígida.
- **Sem análise gramatical determinística de terceiros** (ex.: LanguageTool) — a camada
  determinística é um conjunto de regras próprias (repetição, pontuação, pleonasmos, cacofonias
  conhecidas); concordância/regência/conjugação ficam a cargo do modelo de IA, sempre com o trecho
  citado.

## Roadmap (segunda fase, não implementada)

Upload/gravação de áudio, detecção de BPM e tonalidade, comparação entre emoção da letra e do
áudio, extensão vocal e sugestão de transposição, importação de cifras, comentários colaborativos,
compartilhamento com produtor/pastor/coautor, tradução bíblica selecionável entre múltiplas
licenças oficiais (YouVersion/API.Bible) além do conjunto de domínio público atual, um limite de
chamadas durável (ex.: Durable Objects) caso o limite em memória se mostre insuficiente.
