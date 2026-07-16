import { useEffect, useState } from "react";
import { subscribeToAnalysis } from "../repositories/analysesRepository.js";
import type { AnalysisDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useAnalysis(
  songId: string | undefined,
  analysisId: string | undefined | null
): { analysis: WithId<AnalysisDoc> | null; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<WithId<AnalysisDoc> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !songId || !analysisId) {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToAnalysis(
      user.uid,
      songId,
      analysisId,
      (next) => {
        setAnalysis(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, songId, analysisId]);

  return { analysis, loading, error };
}
