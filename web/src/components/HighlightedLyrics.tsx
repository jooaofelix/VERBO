import type { AnalysisFinding, SongSection } from "@verbo/shared";
import { Fragment } from "react";
import { CATEGORY_MARK_CLASS } from "./badges.js";
import { FindingCard } from "./FindingCard.js";

interface Props {
  sections: SongSection[];
  findings: AnalysisFinding[];
  decisions: Record<string, "accepted" | "ignored">;
  onDecide: (findingId: string, decision: "accepted" | "ignored" | undefined) => void;
}

interface Segment {
  text: string;
  finding?: AnalysisFinding;
}

function segmentText(text: string, findings: AnalysisFinding[]): Segment[] {
  const matches = findings
    .map((f) => ({ finding: f, index: text.indexOf(f.originalExcerpt) }))
    .filter((m) => m.index >= 0 && m.finding.originalExcerpt.trim().length > 0)
    .sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.index < cursor) continue; // overlaps a previous highlight, skip
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index) });
    }
    const end = match.index + match.finding.originalExcerpt.length;
    segments.push({ text: text.slice(match.index, end), finding: match.finding });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }
  return segments;
}

export function HighlightedLyrics({ sections, findings, decisions, onDecide }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-ink-800/10 bg-white/60 p-4 dark:border-parchment-50/10 dark:bg-ink-900/50">
        {sections.map((section) => {
          const relevant = findings.filter(
            (f) => !f.sectionId || f.sectionId === section.id
          );
          const segments = segmentText(section.text, relevant);
          return (
            <div key={section.id} className="mb-4 last:mb-0">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-700/50 dark:text-parchment-100/40">
                {section.label}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {segments.map((seg, i) => {
                  if (!seg.finding) return <Fragment key={i}>{seg.text}</Fragment>;
                  const decided = decisions[seg.finding.id];
                  return (
                    <a
                      key={i}
                      href={`#finding-${seg.finding.id}`}
                      title={seg.finding.title}
                      className={`rounded px-0.5 underline decoration-2 underline-offset-2 ${
                        CATEGORY_MARK_CLASS[seg.finding.category]
                      } ${decided === "ignored" ? "opacity-40" : ""}`}
                    >
                      {seg.text}
                    </a>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {findings.map((f) => (
          <div key={f.id} id={`finding-${f.id}`} className="scroll-mt-20">
            <FindingCard
              finding={f}
              decision={decisions[f.id]}
              onDecide={(decision) => onDecide(f.id, decision)}
            />
          </div>
        ))}
        {findings.length === 0 && (
          <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">
            Nenhum achado destacado para esta letra.
          </p>
        )}
      </div>
    </div>
  );
}
