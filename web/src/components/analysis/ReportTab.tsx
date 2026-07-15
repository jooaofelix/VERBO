import { useMemo, useState } from "react";
import {
  copyReportToClipboard,
  downloadReportAsDocx,
  downloadReportAsPdf,
  downloadReportAsTxt,
} from "../../lib/export.js";
import { buildFinalReport } from "../../lib/report.js";
import type { Song, SongVersion } from "../../state/types.js";

interface Props {
  song: Song;
  version: SongVersion;
}

export function ReportTab({ song, version }: Props) {
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => buildFinalReport(song, version), [song, version]);
  const filename = `${song.title || "composicao"}-${version.versionName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadReportAsTxt(report, filename)}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
        >
          Baixar .txt
        </button>
        <button
          type="button"
          onClick={() => downloadReportAsDocx(report, filename)}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
        >
          Baixar .docx
        </button>
        <button
          type="button"
          onClick={() => downloadReportAsPdf(report, filename)}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
        >
          Baixar .pdf
        </button>
        <button
          type="button"
          onClick={async () => {
            await copyReportToClipboard(report);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg border border-verse-500/40 px-3 py-1.5 text-sm text-verse-600 dark:text-verse-400"
        >
          {copied ? "Copiado!" : "Copiar texto"}
        </button>
      </div>

      <p className="text-xs text-ink-700/50 dark:text-parchment-100/40">
        Não há link privado nesta versão sem login — exporte um arquivo para guardar ou
        compartilhar o relatório manualmente.
      </p>

      <div className="rounded-xl border border-ink-800/10 bg-white/60 p-4 text-sm dark:border-parchment-50/10 dark:bg-ink-900/50">
        <h3 className="font-display text-lg font-semibold">{report.songTitle || "(sem título)"}</h3>
        {report.author && <p className="text-ink-700/60 dark:text-parchment-100/50">{report.author}</p>}
        <p className="mt-1 text-xs text-ink-700/50 dark:text-parchment-100/40">
          Versão: {report.versionName} · {new Date(report.analyzedAt).toLocaleString("pt-BR")}
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <ReportBlock title="Intenção declarada" items={[report.declaredIntent]} />
          <ReportBlock title="Mensagem percebida" items={[report.perceivedMessage]} />
          <ReportBlock title="Pontos fortes" items={report.strengths} />
          <ReportBlock title="Pontos de atenção" items={report.attentionPoints} />
          <ReportBlock title="Perguntas pendentes" items={report.pendingQuestions} />
          <ReportBlock title="Sugestões prioritárias" items={report.prioritySuggestions} />
          <ReportBlock title="Limitações desta análise" items={report.limitations} />
        </div>
      </div>
    </div>
  );
}

function ReportBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
        {title}
      </p>
      <ul className="mt-1 list-disc pl-5 text-ink-700/80 dark:text-parchment-100/70">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
