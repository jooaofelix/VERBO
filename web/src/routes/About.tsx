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

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Sem login</h2>
        <p>
          Não existe cadastro, senha ou conta. Cada composição e cada versão ficam salvas apenas
          no armazenamento local (localStorage) deste navegador, neste dispositivo. Limpar os
          dados do site, trocar de navegador ou de aparelho apaga o histórico — não há nuvem nem
          backup automático.
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
          Se o servidor não tiver uma chave de API de IA configurada, a análise roda em modo
          demonstração: o resultado tem a mesma estrutura de uma análise real, mas o conteúdo é um
          exemplo fixo, claramente identificado como tal.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Privacidade</h2>
        <p>
          Sua letra é enviada ao servidor apenas no momento em que você pede uma análise, para
          gerar o resultado — ela não é publicada, indexada ou compartilhada automaticamente. Este
          app não constitui registro legal de direitos autorais.
        </p>

        <h2 className="mt-2 font-medium text-ink-950 dark:text-parchment-50">Limitações</h2>
        <ul className="list-disc pl-5">
          <li>Pluralidade teológica é sinalizada, mas não substitui aconselhamento pastoral.</li>
          <li>Estimativas de prosódia e emoção podem mudar completamente com melodia real.</li>
          <li>O conjunto de versículos com texto disponível é pequeno e não cobre toda a Bíblia.</li>
          <li>Não há backup em nuvem: exporte o relatório se quiser guardar uma cópia externa.</li>
        </ul>
      </section>
    </div>
  );
}
