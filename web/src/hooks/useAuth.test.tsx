import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./useAuth.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const completeGoogleRedirectSignInMock = vi.fn();
const subscribeToAuthStateMock = vi.fn();

vi.mock("../services/firebase/auth.js", () => ({
  completeGoogleRedirectSignIn: () => completeGoogleRedirectSignInMock(),
  subscribeToAuthState: (cb: (u: unknown) => void) => subscribeToAuthStateMock(cb),
}));

vi.mock("../services/firebase/emulators.js", () => ({
  connectToFirebaseEmulatorsIfConfigured: vi.fn(),
}));

vi.mock("../repositories/usersRepository.js", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue(undefined),
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? `user:${user.uid}` : "no-user"}</div>;
}

beforeEach(() => {
  navigateMock.mockReset();
  completeGoogleRedirectSignInMock.mockReset();
  subscribeToAuthStateMock.mockReset();
  subscribeToAuthStateMock.mockImplementation(() => () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider — redirect completion", () => {
  it("shows 'Concluindo seu login...' while the redirect result is pending", async () => {
    completeGoogleRedirectSignInMock.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Concluindo seu login...")).toBeInTheDocument();
    expect(screen.queryByText("no-user")).not.toBeInTheDocument();
  });

  it("navigates to /inicio when a redirect sign-in just completed", async () => {
    completeGoogleRedirectSignInMock.mockResolvedValue({ uid: "redirected-user" });
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/inicio", { replace: true }));
  });

  it("does not navigate when there is no pending redirect result", async () => {
    completeGoogleRedirectSignInMock.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText("Concluindo seu login...")).not.toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("renders children (the rest of the app) once the redirect check resolves", async () => {
    completeGoogleRedirectSignInMock.mockResolvedValue(null);
    subscribeToAuthStateMock.mockImplementation((cb: (u: unknown) => void) => {
      cb(null);
      return () => {};
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("no-user");
  });

  it("never leaves a blank screen if getRedirectResult itself throws", async () => {
    completeGoogleRedirectSignInMock.mockRejectedValue({ code: "auth/internal-error" });
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText(/ocorreu um erro interno/i);
    expect(screen.getByText("Continuar")).toBeInTheDocument();
  });
});
