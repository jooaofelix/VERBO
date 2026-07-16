import { useEffect, useState } from "react";
import { subscribeToVersions } from "../repositories/versionsRepository.js";
import type { VersionDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSongVersions(songId: string | undefined): {
  versions: WithId<VersionDoc>[];
  loading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  const [versions, setVersions] = useState<WithId<VersionDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !songId) {
      setVersions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToVersions(
      user.uid,
      songId,
      (next) => {
        setVersions(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, songId]);

  return { versions, loading, error };
}
