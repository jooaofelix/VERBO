import type { AnalysisResult } from "@verbo/shared";

function BoolRow({ label, value }: { label: string; value: boolean | undefined }) {
  if (value === undefined) return null;
  return (
    <li className="flex items-center gap-2">
      <span className={value ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
        {value ? "✓" : "✕"}
      </span>
      {label}
    </li>
  );
}

const STRUCTURE_LABEL: Record<string, string> = {
  narrativa: "Narrativa",
  circular: "Circular",
  contemplativa: "Contemplativa",
  declarativa: "Declarativa",
  liturgica: "Litúrgica",
  confessional: "Confessional",
  poetica: "Poética",
  exortativa: "Exortativa",
  testemunhal: "Testemunhal",
};

export function CoherenceTab({ result }: { result: AnalysisResult }) {
  const { coherence } = result;
  const map = coherence.narrativeMap;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Coerência entre seções</h3>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-700/80 dark:text-parchment-100/70">
          <BoolRow label="A mensagem declarada aparece claramente" value={coherence.messageAppearsClearly} />
          <BoolRow label="O refrão representa a ideia central" value={coherence.chorusRepresentsCentralIdea} />
          <BoolRow label="Os versos desenvolvem a mensagem" value={coherence.versesDevelopMessage} />
          <BoolRow label="O final entrega o resultado emocional esperado" value={coherence.endingDeliversPayoff} />
          <BoolRow label="O eu lírico permanece consistente" value={coherence.lyricalSubjectConsistent} />
          <BoolRow label="O destinatário permanece consistente" value={coherence.addresseeConsistent} />
          <BoolRow label="A imagem principal é desenvolvida" value={coherence.mainImageDeveloped} />
        </ul>
        {coherence.bridgeAddsOrRepeats && (
          <p className="mt-2 text-sm text-ink-700/70 dark:text-parchment-100/60">
            Ponte: {coherence.bridgeAddsOrRepeats === "acrescenta" ? "acrescenta algo novo" : coherence.bridgeAddsOrRepeats === "repete" ? "repete o que já foi dito" : "não há ponte nesta letra"}.
          </p>
        )}
        {coherence.topicShiftDetected && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Mudança de assunto: {coherence.topicShiftDetected}
          </p>
        )}
        {coherence.contradictionDetected && (
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">
            Possível contradição interna: {coherence.contradictionDetected}
          </p>
        )}
        <p className="mt-2 text-sm text-ink-700/70 dark:text-parchment-100/60">
          Intensidade ao longo da letra: <strong>{coherence.intensityTrend}</strong>
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Mapa da narrativa <span className="font-normal text-ink-700/60 dark:text-parchment-100/50">({STRUCTURE_LABEL[map.structureType] ?? map.structureType})</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["Ponto de partida", map.startingPoint],
            ["Conflito/tensão", map.conflictOrTension],
            ["Desenvolvimento", map.development],
            ["Revelação", map.revelation],
            ["Resposta", map.response],
            ["Conclusão", map.conclusion],
          ]
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label} className="rounded-lg border border-ink-800/10 p-2 text-sm dark:border-parchment-50/10">
                <p className="text-xs font-medium uppercase text-ink-700/50 dark:text-parchment-100/40">
                  {label}
                </p>
                <p className="mt-0.5">{v}</p>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Ponto de vista</h3>
        <p className="text-sm text-ink-700/80 dark:text-parchment-100/70">
          <strong>{coherence.pointOfView.dominantPerson}</strong> — {coherence.pointOfView.whoSpeaks} fala com{" "}
          {coherence.pointOfView.toWhom}
          {coherence.pointOfView.aboutWhom ? `, sobre ${coherence.pointOfView.aboutWhom}` : ""}.
        </p>
        {coherence.pointOfView.shifts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-700/70 dark:text-parchment-100/60">
            {coherence.pointOfView.shifts.map((shift, i) => (
              <li key={i}>
                {shift.from} → {shift.to}: {shift.note}
              </li>
            ))}
          </ul>
        )}
      </section>

      {coherence.unansweredQuestions.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Perguntas que a letra deixa em aberto</h3>
          <ul className="list-disc pl-5 text-sm text-ink-700/80 dark:text-parchment-100/70">
            {coherence.unansweredQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
