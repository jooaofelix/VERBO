import { useEffect, useState } from "react";
import { subscribeToSongs } from "../repositories/songsRepository.js";
import type { SongDoc, WithId } from "../types/firestore.js";
import { useAuth } from "./useAuth.js";

export function useSongs(): { songs: WithId<SongDoc>[]; loading: boolean; error: Error | null } {
  const { user } = useAuth();
  const [songs, setSongs] = useState<WithId<SongDoc>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSongs([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToSongs(
      user.uid,
      (next) => {
        setSongs(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  return { songs, loading, error };
}
