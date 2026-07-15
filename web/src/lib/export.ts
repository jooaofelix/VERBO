import type { FinalReport } from "@verbo/shared";

function reportSections(report: FinalReport): Array<[string, string[]]> {
  return [
    ["Intenção declarada", [report.declaredIntent]],
    ["Mensagem percebida", [report.perceivedMessage]],
    ["Estrutura", [report.structureOverview]],
    ["Classificação lírica", [report.lyricalClassification]],
    ["Emoção", [report.emotion]],
    [
      "Referências bíblicas",
      report.bibleReferences.length > 0
        ? report.bibleReferences.map((r) => `${r.referenceLabel} (${r.relationType}) — ${r.explanation}`)
        : ["Nenhuma referência bíblica direta identificada."],
    ],
    ["Contexto bíblico", report.biblicalContextNotes],
    ["Observações teológicas", report.theologicalObservations],
    ["Observações linguísticas", report.linguisticObservations],
    ["Observações de composição", report.compositionObservations],
    ["Observações de produção", report.productionObservations],
    ["Adequação congregacional", [report.congregationalFit]],
    ["Pontos fortes", report.strengths],
    ["Pontos de atenção", report.attentionPoints],
    ["Perguntas pendentes ao compositor", report.pendingQuestions],
    ["Sugestões prioritárias", report.prioritySuggestions],
    ["Limitações desta análise", report.limitations],
  ];
}

export function reportToText(report: FinalReport): string {
  const lines: string[] = [];
  lines.push(`VERBO & CANÇÃO — Relatório de análise`);
  lines.push(`Música: ${report.songTitle ?? "(sem título)"}`);
  if (report.author) lines.push(`Autor: ${report.author}`);
  lines.push(`Versão: ${report.versionName}`);
  lines.push(`Analisado em: ${new Date(report.analyzedAt).toLocaleString("pt-BR")}`);
  lines.push("");

  for (const [title, items] of reportSections(report)) {
    if (items.length === 0) continue;
    lines.push(`## ${title}`);
    for (const item of items) lines.push(`- ${item}`);
    lines.push("");
  }

  lines.push("## Letra original");
  lines.push(report.originalLyrics);
  if (report.revisedLyrics) {
    lines.push("");
    lines.push("## Letra revisada");
    lines.push(report.revisedLyrics);
  }

  return lines.join("\n");
}

export async function copyReportToClipboard(report: FinalReport): Promise<void> {
  await navigator.clipboard.writeText(reportToText(report));
}

export function buildTxtBlob(report: FinalReport): Blob {
  return new Blob([reportToText(report)], { type: "text/plain;charset=utf-8" });
}

export async function buildDocxBlob(report: FinalReport): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: "VERBO & CANÇÃO — Relatório de análise", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Música: ${report.songTitle ?? "(sem título)"}` }),
    ...(report.author ? [new Paragraph({ text: `Autor: ${report.author}` })] : []),
    new Paragraph({ text: `Versão: ${report.versionName}` }),
    new Paragraph({ text: `Analisado em: ${new Date(report.analyzedAt).toLocaleString("pt-BR")}` }),
  ];

  for (const [title, items] of reportSections(report)) {
    if (items.length === 0) continue;
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
    for (const item of items) {
      children.push(new Paragraph({ children: [new TextRun(`• ${item}`)] }));
    }
  }

  children.push(new Paragraph({ text: "Letra original", heading: HeadingLevel.HEADING_2 }));
  for (const line of report.originalLyrics.split("\n")) {
    children.push(new Paragraph({ text: line || " " }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export async function buildPdfBlob(report: FinalReport): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const maxWidth = 515;
  let y = 50;
  const pageHeight = doc.internal.pageSize.getHeight();

  function writeLine(text: string, size = 10, bold = false) {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const wrapped = doc.splitTextToSize(text, maxWidth);
    for (const w of wrapped) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 50;
      }
      doc.text(w, marginX, y);
      y += size * 1.35;
    }
  }

  writeLine("VERBO & CANÇÃO — Relatório de análise", 16, true);
  writeLine(`Música: ${report.songTitle ?? "(sem título)"}`);
  if (report.author) writeLine(`Autor: ${report.author}`);
  writeLine(`Versão: ${report.versionName}`);
  writeLine(`Analisado em: ${new Date(report.analyzedAt).toLocaleString("pt-BR")}`);
  y += 8;

  for (const [title, items] of reportSections(report)) {
    if (items.length === 0) continue;
    writeLine(title, 12, true);
    for (const item of items) writeLine(`• ${item}`);
    y += 6;
  }

  writeLine("Letra original", 12, true);
  writeLine(report.originalLyrics);

  return doc.output("blob");
}

export function downloadReportAsTxt(report: FinalReport, filename: string): void {
  triggerDownload(buildTxtBlob(report), `${filename}.txt`);
}

export async function downloadReportAsDocx(report: FinalReport, filename: string): Promise<void> {
  triggerDownload(await buildDocxBlob(report), `${filename}.docx`);
}

export async function downloadReportAsPdf(report: FinalReport, filename: string): Promise<void> {
  triggerDownload(await buildPdfBlob(report), `${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
