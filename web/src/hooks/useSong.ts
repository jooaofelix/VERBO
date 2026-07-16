import { useEffect, useState } from "react";
import { subscribeToSong } from "../repositories/songsRepository.js";
import type { SongDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSong(songId: string | undefined): {
  song: WithId<SongDoc> | null;
  loading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();
  const [song, setSong] = useState<WithId<SongDoc> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user || !songId) {
      setSong(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToSong(
      user.uid,
      songId,
      (next) => {
        setSong(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, songId]);

  return { song, loading, error };
}
