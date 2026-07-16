import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ensureUserProfile } from "../repositories/usersRepository.js";
import { connectToFirebaseEmulatorsIfConfigured } from "../services/firebase/emulators.js";
import { completeGoogleRedirectSignIn, subscribeToAuthState } from "../services/firebase/auth.js";
import { friendlyAuthErrorMessage } from "../lib/authErrors.js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingRedirect, setCompletingRedirect] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    connectToFirebaseEmulatorsIfConfigured();
    let cancelled = false;

    // A sign-in started via signInWithRedirect only resolves here, after the
    // full-page round trip back from Google — must be awaited before the
    // app can conclude the user isn't authenticated.
    completeGoogleRedirectSignIn()
      .then((redirectUser) => {
        if (cancelled) return;
        if (redirectUser) navigate("/inicio", { replace: true });
      })
      .catch((err: unknown) => {
        if (!cancelled) setRedirectError(friendlyAuthErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setCompletingRedirect(false);
      });

    const unsubscribe = subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) void ensureUserProfile(nextUser);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  if (completingRedirect) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-700/60 dark:text-parchment-100/50">
        Concluindo seu login...
      </div>
    );
  }

  if (redirectError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{redirectError}</p>
        <button
          type="button"
          onClick={() => setRedirectError(null)}
          className="rounded-xl bg-verse-600 px-5 py-2.5 font-medium text-white hover:bg-verse-500"
        >
          Continuar
        </button>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
