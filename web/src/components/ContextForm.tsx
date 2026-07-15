import type { SongContextInput } from "@verbo/shared";

interface Props {
  value: SongContextInput;
  onChange: (patch: Partial<SongContextInput>) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-800 dark:text-parchment-100/90">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

export function ContextForm({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
        Nenhum campo aqui é obrigatório. Quanto mais contexto você der, mais a análise consegue
        comparar a letra com o que você realmente quis dizer — mas você pode pular direto para a
        letra se preferir.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mensagem central da música">
          <textarea
            className={inputClass}
            rows={2}
            value={value.centralMessage ?? ""}
            onChange={(e) => onChange({ centralMessage: e.target.value })}
            placeholder="Ex.: Deus permanece fiel mesmo quando eu não entendo o que estou vivendo."
          />
        </Field>
        <Field label="O que você quer que a pessoa compreenda ou sinta?">
          <textarea
            className={inputClass}
            rows={2}
            value={value.desiredUnderstanding ?? ""}
            onChange={(e) => onChange({ desiredUnderstanding: e.target.value })}
          />
        </Field>
        <Field label="Existe uma história por trás da composição?">
          <textarea
            className={inputClass}
            rows={2}
            value={value.backstory ?? ""}
            onChange={(e) => onChange({ backstory: e.target.value })}
          />
        </Field>
        <Field label="Frase central (se houver)">
          <input
            className={inputClass}
            value={value.centralPhrase ?? ""}
            onChange={(e) => onChange({ centralPhrase: e.target.value })}
          />
        </Field>

        <Field label="A letra é...">
          <select
            className={inputClass}
            value={value.lyricsForm ?? "nao_sei"}
            onChange={(e) => onChange({ lyricsForm: e.target.value as SongContextInput["lyricsForm"] })}
          >
            <option value="nao_sei">Não sei / prefiro não dizer</option>
            <option value="oracao">Uma oração</option>
            <option value="declaracao">Uma declaração</option>
            <option value="narrativa">Uma narrativa</option>
            <option value="testemunho">Um testemunho</option>
            <option value="reflexao">Uma reflexão</option>
            <option value="convite">Um convite</option>
          </select>
        </Field>
        <Field label="Com quem/sobre quem a música fala">
          <select
            className={inputClass}
            value={value.speaksTo ?? "nao_sei"}
            onChange={(e) => onChange({ speaksTo: e.target.value as SongContextInput["speaksTo"] })}
          >
            <option value="nao_sei">Não sei / prefiro não dizer</option>
            <option value="deus">Fala com Deus</option>
            <option value="sobre_deus">Fala sobre Deus</option>
            <option value="igreja">Fala com a igreja</option>
            <option value="uma_pessoa">Fala com uma pessoa</option>
            <option value="consigo_mesmo">Fala consigo mesmo</option>
          </select>
        </Field>

        <Field label="Contexto de uso pretendido">
          <select
            className={inputClass}
            value={value.usageContext ?? "nao_sei"}
            onChange={(e) => onChange({ usageContext: e.target.value as SongContextInput["usageContext"] })}
          >
            <option value="nao_sei">Não sei / prefiro não dizer</option>
            <option value="culto">Culto</option>
            <option value="congregacional">Música congregacional</option>
            <option value="artistica_lancamento">Música artística / lançamento</option>
            <option value="devocional">Devocional</option>
            <option value="evangelizacao">Evangelização</option>
            <option value="criancas">Público infantil</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Público pretendido">
          <input
            className={inputClass}
            value={value.intendedAudience ?? ""}
            onChange={(e) => onChange({ intendedAudience: e.target.value })}
            placeholder="Ex.: jovens adultos, igreja local, todos os públicos..."
          />
        </Field>

        <Field label="Tradição teológica para a análise">
          <select
            className={inputClass}
            value={value.theologicalTradition}
            onChange={(e) =>
              onChange({ theologicalTradition: e.target.value as SongContextInput["theologicalTradition"] })
            }
          >
            <option value="nao_selecionar">Não desejo selecionar uma tradição específica</option>
            <option value="geral">Análise bíblica geral</option>
            <option value="evangelica_ampla">Evangélica ampla</option>
            <option value="protestante_historica">Protestante histórica</option>
            <option value="reformada">Reformada</option>
            <option value="pentecostal">Pentecostal</option>
            <option value="batista">Batista</option>
            <option value="wesleyana_arminiana">Wesleyana ou arminiana</option>
            <option value="catolica">Católica</option>
            <option value="ortodoxa">Ortodoxa</option>
            <option value="outra">Outra</option>
          </select>
        </Field>
        <Field label="Estilo musical imaginado">
          <input
            className={inputClass}
            value={value.intendedStyle ?? ""}
            onChange={(e) => onChange({ intendedStyle: e.target.value })}
            placeholder="Ex.: worship contemporâneo, folk, balada..."
          />
        </Field>

        <Field label="Humor/emoção pretendida">
          <input
            className={inputClass}
            value={value.intendedMood ?? ""}
            onChange={(e) => onChange({ intendedMood: e.target.value })}
            placeholder="Ex.: contemplativa, celebrativa, íntima..."
          />
        </Field>
        <Field label="Quanto você deseja que o sistema altere?">
          <select
            className={inputClass}
            value={value.desiredChangeLevel}
            onChange={(e) =>
              onChange({ desiredChangeLevel: e.target.value as SongContextInput["desiredChangeLevel"] })
            }
          >
            <option value="apontar_problemas">Apenas apontar problemas</option>
            <option value="pequenas_correcoes">Sugerir pequenas correções</option>
            <option value="refinar_mantendo_voz">Refinar mantendo minha voz</option>
            <option value="mudancas_criativas">Propor mudanças criativas</option>
            <option value="versao_alternativa_completa">Criar uma versão alternativa completa</option>
          </select>
        </Field>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.isChristian ?? true}
            onChange={(e) => onChange({ isChristian: e.target.checked })}
          />
          É uma música cristã
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.isExplicitlyBiblical ?? false}
            onChange={(e) => onChange({ isExplicitlyBiblical: e.target.checked })}
          />
          Pretende ser explicitamente bíblica
        </label>
      </div>

      <Field label="Referências bíblicas que você já tinha em mente (opcional, separadas por vírgula)">
        <input
          className={inputClass}
          value={value.bibleReferencesProvidedByUser.join(", ")}
          onChange={(e) =>
            onChange({
              bibleReferencesProvidedByUser: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Ex.: Salmos 84:1-2, João 3:16"
        />
      </Field>
    </div>
  );
}
