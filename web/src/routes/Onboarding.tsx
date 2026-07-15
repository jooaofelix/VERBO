interface Props {
  onDone: () => void;
}

const POINTS = [
  {
    title: "Uma equipe de revisão, não um substituto",
    text: "O sistema ajuda a revisar sua letra como um teólogo, um revisor de português, um compositor e um produtor fariam juntos — a decisão final é sempre sua.",
  },
  {
    title: "Referências bíblicas com contexto",
    text: "Quando a letra parece dialogar com um versículo, a análise mostra a referência, o contexto histórico e literário, e nunca inventa uma citação.",
  },
  {
    title: "Divergências teológicas são sinalizadas",
    text: "Quando uma leitura depende de tradição (reformada, pentecostal, wesleyana, católica...), isso é dito explicitamente, sem impor uma única resposta.",
  },
  {
    title: "Apenas texto, sem áudio",
    text: "Esta versão analisa somente a letra escrita. Estimativas de prosódia e emoção são sempre indicadas como estimativas — sem melodia, tonalidade ou BPM.",
  },
  {
    title: "Sua conta, suas composições",
    text: "Entre com Google, e-mail e senha, ou continue em modo demonstração sem criar conta. Suas composições ficam vinculadas só a você — ninguém mais tem acesso a elas.",
  },
  {
    title: "Sua letra permanece privada",
    text: "As composições são salvas na sua conta e analisadas por funções de servidor autenticadas — nunca são publicadas, indexadas ou compartilhadas automaticamente.",
  },
];

export function Onboarding({ onDone }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="font-display text-3xl font-semibold">Verbo & Canção</h1>
        <p className="mt-2 text-ink-700/70 dark:text-parchment-100/60">
          Apreciação e validação de letras musicais — teologia, português e composição, lado a
          lado com a sua voz autoral.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {POINTS.map((p, i) => (
          <li key={p.title} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-verse-500/15 text-xs font-semibold text-verse-600 dark:text-verse-400">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">{p.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onDone}
        className="mt-2 rounded-xl bg-verse-600 px-5 py-3 font-medium text-white transition hover:bg-verse-500"
      >
        Começar minha primeira composição
      </button>
    </div>
  );
}
