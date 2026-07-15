import type { FinalReport } from "@verbo/shared";
import type { Song, SongVersion } from "../state/types.js";

const FIXED_LIMITATIONS = [
  "Esta análise considerou apenas o texto da letra — nenhum áudio, melodia, tonalidade ou BPM foi enviado.",
  "Estimativas de prosódia (sílabas, comprimento de linha) e de emoção/estilo são aproximações textuais.",
  "O texto bíblico exibido, quando disponível, vem de um conjunto pequeno e curado de versículos de domínio público — não é uma Bíblia completa.",
  "Este relatório não constitui registro legal de direitos autorais.",
];

function describeIntent(version: SongVersion): string {
  const c = version.context;
  const parts: string[] = [];
  if (c.centralMessage) parts.push(`Mensagem central: ${c.centralMessage}`);
  if (c.desiredUnderstanding) parts.push(`O que deseja comunicar: ${c.desiredUnderstanding}`);
  if (c.usageContext) parts.push(`Contexto de uso: ${c.usageContext}`);
  if (c.intendedAudience) parts.push(`Público: ${c.intendedAudience}`);
  if (c.theologicalTradition !== "nao_selecionar") parts.push(`Tradição: ${c.theologicalTradition}`);
  return parts.length > 0 ? parts.join(" — ") : "Nenhum contexto adicional foi informado pelo compositor.";
}

export function buildFinalReport(song: Song, version: SongVersion): FinalReport {
  const result = version.analysis;

  if (!result) {
    throw new Error("Esta versão ainda não tem uma análise concluída.");
  }

  return {
    songTitle: song.title,
    author: song.author,
    versionName: version.versionName,
    analyzedAt: result.createdAt,
    declaredIntent: describeIntent(version),
    perceivedMessage: result.overview.perceivedCentralMessage,
    structureOverview: `${result.overview.compositionType} — estrutura: ${result.coherence.narrativeMap.structureType}`,
    lyricalClassification: result.mood.perceivedFunctions.join(", "),
    emotion: `${result.overview.mainEmotion} (${result.mood.lyricalEmotions.join(", ")}); energia textual: ${result.mood.textualEnergy}`,
    bibleReferences: result.bibleReferences,
    biblicalContextNotes: result.biblicalContext.map(
      (c) => `${c.usageClassification}: ${c.relationToLyrics}`
    ),
    theologicalObservations: result.theologicalClaims.map(
      (c) => `[${c.classification}] ${c.whatItSeemsToAffirm}`
    ),
    linguisticObservations: result.grammarFindings.map((g) => `[${g.type}] "${g.originalExcerpt}" — ${g.explanation}`),
    compositionObservations: result.compositionFindings.map((c) => c.observation),
    productionObservations: [result.mood.disclaimer, result.mood.movementDescription],
    congregationalFit: result.congregational.applicable
      ? (result.congregational.notes ?? "Ver aba Congregacional para detalhes.")
      : "Não avaliado como música congregacional nesta análise.",
    strengths: result.overview.strengths,
    attentionPoints: result.overview.attentionPoints,
    pendingQuestions: result.composerQuestions.map((q) => q.question),
    prioritySuggestions: result.findings.filter((f) => f.suggestion).map((f) => f.suggestion!),
    limitations: [...FIXED_LIMITATIONS, ...result.limitations],
    originalLyrics: version.lyrics,
  };
}
