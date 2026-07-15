import { createApp } from "./app.js";
import { env, isDemoMode } from "./env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(
    `[verbo-e-cancao] servidor rodando na porta ${env.port} (modo: ${
      isDemoMode() ? "DEMONSTRAÇÃO — configure ANTHROPIC_API_KEY para análises reais" : "live"
    })`
  );
});
