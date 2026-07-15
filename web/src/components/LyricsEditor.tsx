import type { SongSection } from "@verbo/shared";
import { useState } from "react";
import { suggestSections } from "../api/client.js";

interface Props {
  lyrics: string;
  onLyricsChange: (lyrics: string) => void;
  sections: SongSection[];
  onSectionsChange: (sections: SongSection[]) => void;
}

const TYPE_LABELS: Record<SongSection["type"], string> = {
  introducao: "Introdução",
  verso: "Verso",
  pre_refrao: "Pré-refrão",
  refrao: "Refrão",
  pos_refrao: "Pós-refrão",
  ponte: "Ponte",
  interludio: "Interlúdio",
  final: "Final",
  fala: "Fala",
  outro: "Outro",
};

export function LyricsEditor({ lyrics, onLyricsChange, sections, onSectionsChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    if (!lyrics.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await suggestSections(lyrics);
      onSectionsChange(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível sugerir a divisão em seções.");
    } finally {
      setLoading(false);
    }
  }

  function updateSection(id: string, patch: Partial<SongSection>) {
    onSectionsChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function mergeWithPrevious(index: number) {
    if (index === 0) return;
    const prev = sections[index - 1];
    const current = sections[index];
    const merged: SongSection = {
      ...prev,
      text: `${prev.text}\n${current.text}`,
      endLine: current.endLine,
    };
    const next = [...sections];
    next.splice(index - 1, 2, merged);
    onSectionsChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink-800 dark:text-parchment-100/90">
          Letra da composição
        </label>
        <textarea
          className="min-h-[16rem] w-full rounded-lg border border-ink-800/15 bg-white/70 p-3 font-mono text-sm leading-relaxed outline-none focus:border-verse-500 dark:border-parchment-50/15 dark:bg-ink-900/60"
          value={lyrics}
          onChange={(e) => {
            onLyricsChange(e.target.value);
            if (sections.length > 0) onSectionsChange([]);
          }}
          placeholder={"Cole ou escreva a letra aqui.\n\nDeixe uma linha em branco entre blocos (versos, refrão, ponte...)."}
        />
        <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
          O texto original nunca é alterado pela análise — sugestões aparecem separadas, ao lado.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={!lyrics.trim() || loading}
          className="rounded-lg border border-verse-500/40 px-4 py-2 text-sm font-medium text-verse-600 transition hover:bg-verse-500/10 disabled:opacity-40 dark:text-verse-400"
        >
          {loading ? "Sugerindo divisão..." : "Sugerir divisão em seções"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {sections.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink-800 dark:text-parchment-100/90">
            Seções sugeridas — corrija o tipo/número se necessário
          </p>
          {sections.map((section, index) => (
            <div
              key={section.id}
              className="rounded-lg border border-ink-800/10 bg-white/60 p-3 dark:border-parchment-50/10 dark:bg-ink-900/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded border border-ink-800/15 bg-transparent px-2 py-1 text-xs dark:border-parchment-50/15"
                  value={section.type}
                  onChange={(e) =>
                    updateSection(section.id, { type: e.target.value as SongSection["type"] })
                  }
                >
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="w-14 rounded border border-ink-800/15 bg-transparent px-2 py-1 text-xs dark:border-parchment-50/15"
                  value={section.index ?? ""}
                  onChange={(e) =>
                    updateSection(section.id, {
                      index: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="nº"
                />
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => mergeWithPrevious(index)}
                    className="ml-auto text-xs text-ink-700/60 underline hover:text-verse-600 dark:text-parchment-100/50"
                  >
                    Unir com a seção anterior
                  </button>
                )}
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-800/90 dark:text-parchment-100/80">
                {section.text}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
