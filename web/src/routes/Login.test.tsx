import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const signInWithGooglePopupMock = vi.fn();
const signInWithGoogleRedirectMock = vi.fn();
const signInWithEmailMock = vi.fn();
const signInAsDemoUserMock = vi.fn();

vi.mock("../services/firebase/auth.js", () => ({
  signInWithGooglePopup: (...args: unknown[]) => signInWithGooglePopupMock(...args),
  signInWithGoogleRedirect: (...args: unknown[]) => signInWithGoogleRedirectMock(...args),
  signInWithEmail: (...args: unknown[]) => signInWithEmailMock(...args),
  signInAsDemoUser: (...args: unknown[]) => signInAsDemoUserMock(...args),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  signInWithGooglePopupMock.mockReset();
  signInWithGoogleRedirectMock.mockReset();
  signInWithEmailMock.mockReset();
  signInAsDemoUserMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Login — Google popup sign-in", () => {
  it("navigates to /inicio on a successful popup sign-in", async () => {
    signInWithGooglePopupMock.mockResolvedValue({ uid: "u1" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/inicio", { replace: true }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls signInWithGooglePopup synchronously from the click handler (no intermediate await)", () => {
    let resolvePopup: (u: unknown) => void = () => {};
    signInWithGooglePopupMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePopup = resolve;
      })
    );
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    // The mock must already have been invoked before this assertion runs —
    // proving the call happened inside the same synchronous click handler.
    expect(signInWithGooglePopupMock).toHaveBeenCalledTimes(1);
    resolvePopup({ uid: "u1" });
  });

  it("shows a friendly message and retry/fullscreen options when the popup is blocked", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/popup-blocked" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByRole("alert");
    expect(
      screen.getByText(/o navegador bloqueou a janela de login/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    expect(screen.getByText("Entrar em tela inteira")).toBeInTheDocument();
  });

  it("shows a friendly message when the popup is closed by the user", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByText(/a janela de login foi fechada antes da conclusão/i);
  });

  it("shows a friendly message for cancelled-popup-request", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/cancelled-popup-request" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByText(/uma nova tentativa de login foi iniciada/i);
  });

  it("shows a friendly message for an unauthorized domain", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/unauthorized-domain" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByText(/ainda não está autorizado no Firebase Authentication/i);
  });

  it("shows a friendly message when Google sign-in is not enabled", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/operation-not-allowed" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByText(/o login com google ainda não está habilitado/i);
  });

  it("never leaves a blank screen on a popup error — the form and a retry panel both render", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/internal-error" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByRole("alert");
    // The rest of the page (email form, heading) is still there — nothing blanked out.
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
  });

  it("shows the raw error code under 'Ver detalhes'", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/internal-error" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));

    await screen.findByText("Ver detalhes");
    expect(screen.getByText("auth/internal-error")).toBeInTheDocument();
  });

  it("retries the popup when 'Tentar novamente' is clicked", async () => {
    signInWithGooglePopupMock.mockRejectedValueOnce({ code: "auth/popup-blocked" });
    signInWithGooglePopupMock.mockResolvedValueOnce({ uid: "u1" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));
    await screen.findByText("Tentar novamente");

    fireEvent.click(screen.getByText("Tentar novamente"));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/inicio", { replace: true }));
    expect(signInWithGooglePopupMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to signInWithRedirect when 'Entrar em tela inteira' is clicked", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/popup-blocked" });
    signInWithGoogleRedirectMock.mockReturnValue(new Promise(() => {}));
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));
    await screen.findByText("Entrar em tela inteira");

    fireEvent.click(screen.getByText("Entrar em tela inteira"));
    expect(signInWithGoogleRedirectMock).toHaveBeenCalledTimes(1);
  });

  it("does not automatically trigger a redirect just because the popup failed", async () => {
    signInWithGooglePopupMock.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderLogin();

    fireEvent.click(screen.getByText("Entrar com Google"));
    await screen.findByRole("alert");

    expect(signInWithGoogleRedirectMock).not.toHaveBeenCalled();
  });
});

describe("Login — email and demo sign-in", () => {
  it("navigates to /inicio after a successful email login", async () => {
    signInWithEmailMock.mockResolvedValue({ uid: "u1" });
    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha123" } });
    fireEvent.click(screen.getByText("Entrar", { selector: "button" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/inicio", { replace: true }));
  });

  it("navigates to /inicio after demo sign-in", async () => {
    signInAsDemoUserMock.mockResolvedValue({ uid: "anon" });
    renderLogin();

    fireEvent.click(screen.getByText(/continuar sem conta/i));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/inicio", { replace: true }));
  });
});
