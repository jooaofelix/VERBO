import type { FinalReport } from "@verbo/shared";
import { useEffect, useState } from "react";
import {
  buildDocxBlob,
  buildPdfBlob,
  copyReportToClipboard,
  downloadReportAsDocx,
  downloadReportAsPdf,
  downloadReportAsTxt,
} from "../../lib/export.js";
import { callGenerateReport } from "../../repositories/analysesRepository.js";
import { uploadUserFile } from "../../services/firebase/storage.js";
import { processUploadedFile } from "../../repositories/filesRepository.js";
import type { SongDoc, VersionDoc, WithId } from "../../types/firestore.js";

interface Props {
  uid: string;
  song: WithId<SongDoc>;
  version: WithId<VersionDoc>;
  analysisId: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ReportTab({ uid, song, version, analysisId }: Props) {
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<"" | "saving" | "saved" | "error">("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    callGenerateReport({ songId: song.id, versionId: version.id, analysisId })
      .then(({ report: generated }) => {
        if (!cancelled) setReport(generated);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não foi possível gerar o relatório.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [song.id, version.id, analysisId]);

  if (loading) {
    return <p className="text-sm text-ink-700/60 dark:text-parchment-100/50">Gerando relatório...</p>;
  }
  if (error || !report) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  const filename = `${song.title || "composicao"}-${version.versionName}`;
  const safeFilename = slugify(filename);

  async function handleSaveCopyToCloud(kind: "pdf" | "docx") {
    setCloudSaveStatus("saving");
    try {
      const blob = kind === "pdf" ? await buildPdfBlob(report!) : await buildDocxBlob(report!);
      const file = new File([blob], `${safeFilename}.${kind}`, { type: blob.type });
      const { storagePath } = await uploadUserFile(uid, kind, file, song.id);
      await processUploadedFile({ storagePath, songId: song.id, kind });
      setCloudSaveStatus("saved");
    } catch {
      setCloudSaveStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadReportAsTxt(report, safeFilename)}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
        >
          Baixar .txt
        </button>
        <button
          type="button"
          onClick={() => downloadReportAsDocx(report, safeFilename)}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm dark:border-parchment-50/15"
        >
          Baixar .docx
        </button>
        <button
          type="button"
          onClick={() => downloadReportAsPdf(report, safeFilename)}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSaveCopyToCloud("pdf")}
          disabled={cloudSaveStatus === "saving"}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-parchment-50/15"
        >
          Salvar cópia em PDF na nuvem
        </button>
        <button
          type="button"
          onClick={() => handleSaveCopyToCloud("docx")}
          disabled={cloudSaveStatus === "saving"}
          className="rounded-lg border border-ink-800/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-parchment-50/15"
        >
          Salvar cópia em DOCX na nuvem
        </button>
        {cloudSaveStatus === "saving" && (
          <span className="text-xs text-ink-700/60 dark:text-parchment-100/50">Enviando...</span>
        )}
        {cloudSaveStatus === "saved" && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            Salvo no Firebase Storage.
          </span>
        )}
        {cloudSaveStatus === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400">
            Não foi possível salvar a cópia na nuvem.
          </span>
        )}
      </div>

      <p className="text-xs text-ink-700/50 dark:text-parchment-100/40">
        Os botões "Baixar" salvam um arquivo direto no seu dispositivo. "Salvar cópia na nuvem"
        também envia o arquivo ao Firebase Storage, vinculado à sua conta, para acesso futuro em
        outro dispositivo.
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
