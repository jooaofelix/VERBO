export function About() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Sobre esta versão</h1>

      <section className="mt-4 flex flex-col gap-3 text-sm text-ink-700/80 dark:text-parchment-100/70">
        <p>
          <strong>Verbo & Canção</strong> ajuda compositores a revisar letras musicais reunindo,
          numa mesma tela, uma leitura teológica, bíblica, linguística e de composição — sem
          substituir a voz do autor.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Sua conta</h2>
        <p>
          Entre com Google, e-mail e senha, ou use o modo demonstração (uma conta anônima, sem
          cadastro). Suas composições, versões e análises ficam salvas no Firestore, vinculadas
          exclusivamente ao seu usuário — ninguém mais consegue ler, listar ou editar seus dados.
          Uma conta anônima funciona normalmente, mas não pode ser recuperada em outro dispositivo
          ou navegador (não há como "logar de volta" numa sessão anônima que foi perdida).
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Apenas texto</h2>
        <p>
          Esta versão analisa somente a letra escrita. Estimativas de sílabas, comprimento de
          linha, emoção e estilo são sempre indicadas como estimativas baseadas apenas no texto —
          nunca em melodia, tonalidade, BPM ou extensão vocal, porque nenhum áudio é enviado.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">
          Referências bíblicas
        </h2>
        <p>
          O sistema identifica referências prováveis e explica o contexto histórico e literário.
          O texto do versículo só é exibido quando disponível em um pequeno conjunto de
          versículos de domínio público (tradução histórica Almeida) mantido no servidor — se a
          referência não estiver nesse conjunto, mostramos apenas a referência e a explicação,
          nunca um texto inventado. Confirme sempre a redação exata numa Bíblia oficial antes de
          citar publicamente.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">
          Modo demonstração
        </h2>
        <p>
          Se as Cloud Functions não tiverem uma chave de API de IA configurada, a análise roda em
          modo demonstração: o resultado tem a mesma estrutura de uma análise real, mas o conteúdo
          é um exemplo fixo, claramente identificado como tal.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">
          Como a análise funciona
        </h2>
        <p>
          A letra nunca é analisada no seu navegador nem por um servidor de terceiros direto: uma
          Cloud Function autenticada lê a versão salva no Firestore, confirma que ela pertence à
          sua conta, e só então chama o provedor de IA — a chave de API nunca fica no frontend.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Privacidade</h2>
        <p>
          Suas composições ficam privadas por padrão, protegidas por regras do Firestore e do
          Storage que restringem cada leitura e escrita à sua própria conta. Este app não
          constitui registro legal de direitos autorais.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">
          Funcionamento offline
        </h2>
        <p>
          O Firestore mantém um cache local no navegador: você consegue ver dados já carregados e
          continuar editando uma letra mesmo sem internet. As alterações sincronizam automaticamente
          quando a conexão voltar — o indicador de salvamento mostra "offline" enquanto isso.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Limitações</h2>
        <ul className="list-disc pl-5">
          <li>Pluralidade teológica é sinalizada, mas não substitui aconselhamento pastoral.</li>
          <li>Estimativas de prosódia e emoção podem mudar completamente com melodia real.</li>
          <li>O conjunto de versículos com texto disponível é pequeno e não cobre toda a Bíblia.</li>
          <li>Uma conta anônima (modo demonstração) não pode ser recuperada se você perder a sessão.</li>
        </ul>
      </section>
    </div>
  );
}
