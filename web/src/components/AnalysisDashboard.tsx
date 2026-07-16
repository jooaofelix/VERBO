import type { AnalysisResult } from "@verbo/shared";
import { useState } from "react";
import { setFindingDecision } from "../repositories/versionsRepository.js";
import type { SongDoc, VersionDoc, WithId } from "../types/firestore.js";
import { BibleTheologyTab } from "./analysis/BibleTheologyTab.js";
import { CoherenceTab } from "./analysis/CoherenceTab.js";
import { CompositionTab } from "./analysis/CompositionTab.js";
import { CongregationalTab } from "./analysis/CongregationalTab.js";
import { OverviewTab } from "./analysis/OverviewTab.js";
import { QuestionsTab } from "./analysis/QuestionsTab.js";
import { GrammarTab } from "./analysis/GrammarTab.js";
import { ReportTab } from "./analysis/ReportTab.js";
import { SuggestionsTab } from "./analysis/SuggestionsTab.js";
import { HighlightedLyrics } from "./HighlightedLyrics.js";

const TABS = [
  "Visão geral",
  "Letra destacada",
  "Bíblia & Teologia",
  "Mensagem & Coerência",
  "Português",
  "Composição",
  "Congregacional",
  "Sugestões",
  "Perguntas",
  "Relatório",
] as const;

type Tab = (typeof TABS)[number];

interface Props {
  uid: string;
  song: WithId<SongDoc>;
  version: WithId<VersionDoc>;
  result: AnalysisResult;
}

const AREA_LABELS: Record<string, string> = {
  biblica_teologica: "Bíblia & Teologia",
  portugues: "Português",
  composicao: "Composição",
  congregacional: "Congregacional",
};

export function AnalysisDashboard({ uid, song, version, result }: Props) {
  const [tab, setTab] = useState<Tab>("Visão geral");
  const decisions = version.findingDecisions ?? {};
  const unavailableSections = Object.entries(result.sectionStatus ?? {}).filter(
    ([, s]) => s.status === "indisponivel"
  );

  function handleDecide(findingId: string, decision: "accepted" | "ignored" | undefined) {
    void setFindingDecision(uid, song.id, version.id, findingId, decision);
  }

  return (
    <div>
      {result.disclaimers.length > 0 && (
        <div className="mb-4 flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          {result.disclaimers.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </div>
      )}

      {unavailableSections.length > 0 && (
        <div className="mb-4 flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Análise parcial</p>
          <p>
            {unavailableSections
              .map(([area]) => AREA_LABELS[area] ?? area)
              .join(", ")}{" "}
            demorou mais que o esperado e não pôde ser concluída agora. As demais partes desta
            análise estão completas — rode a análise novamente para tentar completar o restante.
          </p>
        </div>
      )}

      <div className="scrollbar-thin -mx-4 mb-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
              tab === t
                ? "bg-verse-600 text-white"
                : "bg-ink-800/5 text-ink-700/70 dark:bg-parchment-50/5 dark:text-parchment-100/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Visão geral" && <OverviewTab result={result} />}
      {tab === "Letra destacada" && (
        <HighlightedLyrics
          sections={version.sections}
          findings={result.findings}
          decisions={decisions}
          onDecide={handleDecide}
        />
      )}
      {tab === "Bíblia & Teologia" && <BibleTheologyTab result={result} />}
      {tab === "Mensagem & Coerência" && <CoherenceTab result={result} />}
      {tab === "Português" && <GrammarTab result={result} />}
      {tab === "Composição" && <CompositionTab result={result} />}
      {tab === "Congregacional" && <CongregationalTab result={result} />}
      {tab === "Sugestões" && (
        <SuggestionsTab result={result} decisions={decisions} onDecide={handleDecide} />
      )}
      {tab === "Perguntas" && <QuestionsTab result={result} />}
      {tab === "Relatório" && <ReportTab song={song} version={version} result={result} />}
    </div>
  );
}
