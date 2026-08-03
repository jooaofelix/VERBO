import { useState, type ReactNode } from "react";
import type { SongContextInput } from "@verbo/shared";

interface Props {
  value: SongContextInput;
  onChange: (patch: Partial<SongContextInput>) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-800 dark:text-parchment-100/90">{label}</span>
      {children}
    </label>
  );
}

// A <label> should wrap exactly one form control — a row of several chip
// <button>s (plus an optional text input) inside one <label> is invalid HTML
// and confuses the browser's accessible-name computation for each button.
// This is a plain <div> with the same look, used wherever a field holds more
// than one interactive control.
function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink-800 dark:text-parchment-100/90">{label}</span>
      {children}
    </div>
  );
}

const inputClass =
  "rounded-lg border border-ink-800/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60";

function chipClass(active: boolean): string {
  return active
    ? "rounded-full border border-verse-500 bg-verse-500/15 px-3 py-1 text-xs text-verse-700 transition-colors dark:text-verse-300"
    : "rounded-full border border-ink-800/15 bg-white/50 px-3 py-1 text-xs text-ink-700/80 transition-colors hover:border-verse-500/50 dark:border-parchment-50/15 dark:bg-ink-900/40 dark:text-parchment-100/70";
}

/**
 * A single-select field presented as clickable chips instead of typing —
 * "Outro" reveals a small text input only when a value outside the presets
 * is (or was) chosen, so free text stays available without being the default.
 */
function ChipChoice({
  label,
  presets,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const isCustomValue = value !== "" && !presets.includes(value);
  const [customMode, setCustomMode] = useState(isCustomValue);

  return (
    <FieldGroup label={label}>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange(preset);
            }}
            className={chipClass(!customMode && value === preset)}
          >
            {preset}
          </button>
        ))}
        <button type="button" onClick={() => setCustomMode(true)} className={chipClass(customMode)}>
          Outro
        </button>
      </div>
      {customMode && (
        <input
          className={`${inputClass} mt-2`}
          value={isCustomValue ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </FieldGroup>
  );
}

const BIBLE_REFERENCE_PRESETS = [
  "Salmos 23",
  "Salmos 91",
  "João 3:16",
  "Romanos 8:28",
  "Filipenses 4:6-7",
  "Isaías 41:10",
  "Salmos 46:1",
  "Mateus 11:28",
];

/** Well-known base verses as toggle chips, plus a small "add custom" field for anything not in the preset list. */
function BibleReferenceChips({ value, onChange }: { value: string[]; onChange: (refs: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const customRefs = value.filter((r) => !BIBLE_REFERENCE_PRESETS.includes(r));

  function toggle(ref: string) {
    onChange(value.includes(ref) ? value.filter((r) => r !== ref) : [...value, ref]);
  }

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <FieldGroup label="Referências bíblicas que você já tinha em mente (opcional)">
      <div className="flex flex-wrap gap-2">
        {BIBLE_REFERENCE_PRESETS.map((ref) => (
          <button key={ref} type="button" onClick={() => toggle(ref)} className={chipClass(value.includes(ref))}>
            {ref}
          </button>
        ))}
        {customRefs.map((ref) => (
          <button key={ref} type="button" onClick={() => toggle(ref)} className={chipClass(true)}>
            {ref} ✕
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Outra referência (ex.: Salmos 84:1-2)"
        />
        <button
          type="button"
          onClick={addDraft}
          className="rounded-lg border border-ink-800/15 px-3 py-2 text-sm dark:border-parchment-50/15"
        >
          Adicionar
        </button>
      </div>
    </FieldGroup>
  );
}

export function ContextForm({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-700/70 dark:text-parchment-100/60">
        Nenhum campo aqui é obrigatório. Quanto mais contexto você der, mais a análise consegue
        comparar a letra com o que você realmente quis dizer — mas você pode pular direto para a
        letra se preferir.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <ChipChoice
          label="Público pretendido"
          presets={["Jovens", "Adultos", "Todos os públicos", "Público infantil", "Igreja local"]}
          value={value.intendedAudience ?? ""}
          onChange={(v) => onChange({ intendedAudience: v })}
          placeholder="Descreva o público"
        />
        <ChipChoice
          label="Estilo musical imaginado"
          presets={["Worship contemporâneo", "Hino tradicional", "Gospel", "Balada", "Folk/acústico", "Rock cristão"]}
          value={value.intendedStyle ?? ""}
          onChange={(v) => onChange({ intendedStyle: v })}
          placeholder="Descreva o estilo"
        />
        <ChipChoice
          label="Humor/emoção pretendida"
          presets={["Contemplativa", "Celebrativa", "Íntima", "Alegre", "Urgente/clamor", "Consoladora"]}
          value={value.intendedMood ?? ""}
          onChange={(v) => onChange({ intendedMood: v })}
          placeholder="Descreva o humor/emoção"
        />
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

      <BibleReferenceChips
        value={value.bibleReferencesProvidedByUser}
        onChange={(refs) => onChange({ bibleReferencesProvidedByUser: refs })}
      />

      <details className="rounded-lg border border-ink-800/10 px-3 py-2 dark:border-parchment-50/10">
        <summary className="cursor-pointer text-sm font-medium text-ink-800 dark:text-parchment-100/90">
          Mais detalhes sobre a composição (opcional)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        </div>
      </details>
    </div>
  );
}
