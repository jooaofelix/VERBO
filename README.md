# Verbo & Canção

Apreciação e validação de letras musicais — teologia, português e composição, lado a lado
com a voz autoral do compositor. Esta versão usa **Firebase** para tudo que é dado persistente
(contas, composições, versões, análises, arquivos): front-end estático publicado no Cloudflare
Pages, autenticação e banco de dados no Firebase, IA rodando dentro de Cloud Functions.

## Arquitetura

Um monorepo com três pacotes npm workspaces:

- **`shared/`** — schemas Zod que definem todo o contrato de dados (achados, referências bíblicas,
  afirmações teológicas, prosódia, relatório final...). Usado tanto pelas Cloud Functions quanto
  pelo front-end, então uma resposta que não bate com o schema nunca chega à tela nem ao banco.
- **`functions/`** — Firebase Cloud Functions (2ª geração, TypeScript). Nove funções *callable*
  autenticadas: `analyzeLyrics`, `detectBibleReferences`, `analyzeTheology`, `analyzeGrammar`,
  `analyzeComposition`, `compareVersions`, `generateReport`, `processUploadedFile` e
  `suggestSections`. Nenhuma delas confia em `userId` vindo do cliente — o UID sempre vem do token
  de autenticação verificado pelo próprio Firebase.
- **`web/`** — SPA em React + TypeScript + Vite + Tailwind, PWA instalável, tema claro/escuro,
  mobile-first. Publicada como arquivos estáticos no **Cloudflare Pages** (Cloudflare não hospeda
  nenhum dado — só os arquivos do front-end).

Bancos e serviços, todos Firebase:

- **Firebase Authentication** — Google, e-mail/senha (com recuperação de senha) e modo
  demonstração via conta anônima (isolada por UID como qualquer outra conta).
- **Cloud Firestore** — única fonte de dados para usuários, composições, versões, análises,
  relatórios e configurações. Sem localStorage, sem D1, sem KV.
- **Firebase Storage** — único destino para arquivos (PDFs/DOCX exportados, futuros áudios,
  capas, anexos). O Firestore guarda apenas metadados (caminho, nome, tipo, tamanho, dono, data).
- **Firebase Cloud Functions** — todo o backend, incluindo a única chamada ao provedor de IA
  (Anthropic Claude). A chave de API nunca existe no frontend.

### Estrutura do Firestore

```
users/{userId}                                    perfil do usuário
users/{userId}/songs/{songId}                     composição (título, autor, status...)
users/{userId}/songs/{songId}/versions/{versionId} letra, seções, contexto, análise atual
users/{userId}/songs/{songId}/analyses/{analysisId}  resultado da análise (só Cloud Functions escrevem)
users/{userId}/songs/{songId}/references/{referenceId} referências bíblicas salvas pelo usuário
users/{userId}/songs/{songId}/comments/{commentId}   comentários
users/{userId}/songs/{songId}/attachments/{id}       metadados de arquivos anexados (só Cloud Functions escrevem)
users/{userId}/settings/{documentId}                 preferências e contadores internos de limite de uso
users/{userId}/reports/{reportId}                    relatórios finais gerados (só Cloud Functions escrevem)
users/{userId}/files/{fileId}                        metadados de arquivos avulsos (só Cloud Functions escrevem)
```

`firestore.rules` garante que cada leitura/escrita fica restrita ao próprio UID autenticado, que
ninguém pode gravar um `userId` diferente do seu, que `title`/`lyrics` respeitam limites de
tamanho, e que as coleções escritas por Cloud Functions (`analyses`, `attachments`, `reports`,
`files`, contadores `rateLimit_*`) nunca aceitam escrita direta do cliente.

### Fluxo de análise

1. O front-end salva a letra como uma `SongVersion` no Firestore (autosave com debounce).
2. O front-end chama a *callable* `analyzeLyrics({songId, versionId})` — autenticada.
3. A função **lê a letra do Firestore** (nunca confia numa cópia enviada pelo cliente), confirma
   que a versão pertence ao UID do token, aplica um limite de tamanho e um limite de chamadas por
   hora por usuário.
4. Rodam checagens determinísticas de português (regex/dicionário — nunca alucinam) e uma
   estimativa de prosódia (sílabas por linha), sempre calculadas no servidor, nunca pela IA.
5. Uma única chamada ao Claude com *tool use* forçado retorna um JSON coerente com o schema Zod
   (visão geral, referências bíblicas, teologia, coerência narrativa, composição, refrão, rimas,
   emoção, adequação congregacional, perguntas, sugestões). Se a resposta não bater com o schema,
   há uma tentativa automática de reparo antes de desistir.
6. Toda referência bíblica que o modelo identificar é cruzada com um pequeno dataset curado de
   versículos de domínio público — o texto do versículo só aparece se estiver nesse dataset; a IA
   é instruída a nunca escrever o texto bíblico, e mesmo que escrevesse, o servidor descarta e
   substitui pelo resultado dessa consulta.
7. O resultado é validado contra o schema e só então gravado em
   `users/{uid}/songs/{songId}/analyses/{analysisId}` — nunca uma resposta inválida chega ao
   Firestore.

## Como executar localmente

Pré-requisitos: Node.js 20+, npm, e o Firebase CLI (`npm install -g firebase-tools` ou use o que
já vem como devDependency do projeto via `npx firebase`). Java é necessário apenas para rodar os
emuladores do Firestore/Storage localmente.

```bash
npm install                 # instala as três workspaces (shared/functions/web)
```

### Opção A — contra um projeto Firebase real

```bash
cp web/.env.example web/.env
# preencha web/.env com as credenciais do seu projeto Firebase (veja "Configurar o Firebase" abaixo)

npm run dev                 # builda shared, sobe o emulador de functions + o Vite dev server
```

### Opção B — inteiramente contra o Firebase Emulator Suite (sem projeto real)

```bash
cp web/.env.example web/.env
# em web/.env, defina VITE_USE_FIREBASE_EMULATORS=true
# os demais VITE_FIREBASE_* podem ficar com qualquer valor de exemplo

npm run emulators            # sobe auth+firestore+storage+functions localmente
npm run dev -w web           # em outro terminal
```

Sem `ANTHROPIC_API_KEY` configurada (secret em produção, `functions/.env` no emulador), as
funções de análise rodam em **modo demonstração**: a resposta tem a mesma estrutura de uma análise
real, mas o conteúdo é um exemplo fixo, claramente identificado como tal.

### Comandos úteis

```bash
npm run build         # build de produção: shared, functions e web
npm run lint          # eslint em functions/ e web/
npm run typecheck     # tsc --noEmit nos três pacotes
npm run test          # vitest nos três pacotes (35 testes unitários)
npm run test:rules    # testes de firestore.rules/storage.rules no Emulator Suite (22 testes)
npm run test:e2e      # smoke test ponta a ponta: login, salvar, analisar, upload, isolamento
npm run emulators     # sobe o Firebase Emulator Suite (auth, firestore, storage, functions, UI)
```

## Configurar o Firebase (console)

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → ative **E-mail/senha** e **Google**. Ative também
   **Anônimo**, para o modo demonstração.
3. **Firestore Database** → crie o banco (modo produção). As regras deste repositório
   (`firestore.rules`) já cobrem o isolamento por usuário — publique-as no passo de deploy abaixo.
4. **Storage** → crie o bucket padrão. Publique `storage.rules` no deploy.
5. **Functions** → nenhuma ação manual necessária além de ativar o faturamento (Blaze) — Cloud
   Functions 2ª geração exige o plano Blaze mesmo dentro da cota gratuita.
6. Crie a chave da API de IA como **secret** das Cloud Functions (não em `.env`, não no console de
   variáveis simples):
   ```bash
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
7. Em **Configurações do projeto → Seus apps**, crie um app Web e copie as credenciais para
   `web/.env` (veja `web/.env.example` — nenhum desses valores é secreto, eles só identificam o
   projeto; a segurança real vem das rules).
8. Atualize `.firebaserc` com o `projectId` real no lugar de `verbo-e-cancao-SEU-PROJETO`.

### App Check (preparado, não ativado)

O projeto está pronto para adicionar Firebase App Check em Firestore/Storage/Functions, mas o
enforcement **não deve ser ativado sem testar primeiro** — ative o App Check no console, rode a
aplicação em modo de depuração, confirme que nenhuma chamada legítima é bloqueada, e só então
ligue o modo de aplicação (enforce) por serviço.

## Publicação

**Frontend → Cloudflare Pages** (Cloudflare hospeda só os arquivos, nenhum dado):

```bash
npm run build -w web
# publique web/dist/ no Cloudflare Pages (via dashboard ou `wrangler pages deploy web/dist`)
# configure as variáveis VITE_FIREBASE_* nas environment variables do projeto Pages
```

**Backend + banco + auth + storage → Firebase**:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules,functions
```

O passo de deploy das functions já roda `npm run build` automaticamente (configurado em
`firebase.json` → `predeploy`).

## Funcionamento offline

O Firestore mantém cache local (IndexedDB) no navegador. Com isso, o usuário consegue visualizar
dados já carregados e continuar editando uma letra sem internet; as alterações sincronizam
automaticamente quando a conexão retorna. O indicador de salvamento na tela de edição mostra os
estados **salvo / salvando / offline / sincronizando / erro ao salvar**.

## O que já funciona

- Login com Google, e-mail/senha (com recuperação de senha) e modo demonstração anônimo; todas as
  páginas internas exigem autenticação.
- Isolamento por usuário garantido em duas camadas: `firestore.rules`/`storage.rules` (defesa
  primária) e verificação de propriedade dentro de cada Cloud Function (defesa em profundidade).
- Criação de composição sem nenhum campo obrigatório além da letra.
- Formulário de intenção/contexto completo (mensagem, tradição teológica, contexto de uso etc.),
  totalmente opcional.
- Editor de letra com sugestão automática de seções (verso/refrão/ponte...), corrigível pelo
  usuário; autosave com debounce e indicador de estado de salvamento; o texto original nunca é
  alterado silenciosamente.
- Análise completa em abas: Visão geral, Letra destacada, Bíblia & Teologia, Mensagem &
  Coerência, Português, Composição, Congregacional, Sugestões, Perguntas, Relatório.
- Destaques coloridos na letra ligados a cada achado, com botões aceitar/ignorar (a decisão fica
  salva na versão, no Firestore).
- Histórico de versões por composição, duplicação de versão, comparação lado a lado (via Cloud
  Function `compareVersions`) com diff de palavras e uma tabela de dimensões objetivas — sem
  declarar automaticamente qual versão é "melhor".
- Exportação do relatório final (gerado pela Cloud Function `generateReport`) em `.txt`, `.docx`,
  `.pdf`, cópia para a área de transferência, e opção de salvar uma cópia do PDF/DOCX no Firebase
  Storage vinculada à conta.
- Importação única, mediante confirmação, de composições salvas por uma versão anterior deste app
  que usava apenas localStorage (sem login) — as letras e versões são copiadas para o Firestore;
  análises antigas precisam ser refeitas, já que analyses só são gravadas por Cloud Functions.
- Tema claro/escuro, PWA instalável, layout mobile-first.
- 35 testes unitários (schemas, checagens determinísticas, seções, prosódia, banco bíblico,
  proteção contra alucinação, providers de IA), 22 testes de regras de segurança rodando no
  Firebase Emulator Suite, e um smoke test ponta a ponta cobrindo login, isolamento por usuário,
  salvamento, upload e a função de análise contra os emuladores reais.

## Limitações reais

- **Sem áudio.** Nenhuma análise de melodia, BPM, tonalidade ou extensão vocal existe nesta fase —
  a arquitetura (schemas, `processUploadedFile`) está pronta para receber arquivos, mas nenhuma
  análise de áudio foi implementada.
- **Bíblia**: o dataset de versículos com texto disponível é pequeno (~45 versículos muito
  conhecidos, transcritos da tradução histórica Almeida de domínio público) — não é uma Bíblia
  completa, e a redação pode diferir de edições registradas modernas (ARC/ACF/NVI/NAA da SBB).
  Referências fora desse conjunto aparecem sem o texto do versículo.
- **Conta anônima (modo demonstração)** não pode ser recuperada em outro dispositivo ou navegador
  — é uma sessão isolada, não uma conta portátil.
- **App Check** está preparado na arquitetura mas não ativado — ativar o enforcement requer testar
  cada serviço primeiro (ver seção acima).
- **Sem análise gramatical determinística de terceiros** (ex.: LanguageTool) — a camada
  determinística é um conjunto de regras próprias (repetição, pontuação, pleonasmos, cacofonias
  conhecidas); concordância/regência/conjugação ficam a cargo do modelo de IA, sempre com o trecho
  citado.
- **Bundle do frontend** inclui o SDK completo do Firebase (~870KB antes de gzip no chunk
  principal) — funcional, mas um candidato natural a *code splitting* adicional numa próxima fase.

## Roadmap (segunda fase, não implementada)

Upload/gravação de áudio, detecção de BPM e tonalidade, comparação entre emoção da letra e do
áudio, extensão vocal e sugestão de transposição, importação de cifras, comentários colaborativos,
compartilhamento com produtor/pastor/coautor, tradução bíblica selecionável entre múltiplas
licenças oficiais (YouVersion/API.Bible) além do conjunto de domínio público atual, ativação do
Firebase App Check enforcement, code-splitting do bundle do frontend.
