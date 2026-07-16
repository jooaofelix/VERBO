import { beforeEach, describe, expect, it, vi } from "vitest";

const setPersistenceMock = vi.fn().mockResolvedValue(undefined);
const signInWithPopupMock = vi.fn();
const signInWithRedirectMock = vi.fn();
const getRedirectResultMock = vi.fn();
const setCustomParametersMock = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ __fakeAuth: true })),
  browserLocalPersistence: "LOCAL",
  setPersistence: (...args: unknown[]) => setPersistenceMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirectMock(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResultMock(...args),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({
    setCustomParameters: setCustomParametersMock,
  })),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("./app.js", () => ({ firebaseApp: { __fakeApp: true } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("firebase auth wrapper", () => {
  it("sets browserLocalPersistence at module load", async () => {
    await import("./auth.js");
    expect(setPersistenceMock).toHaveBeenCalledWith(expect.anything(), "LOCAL");
  });

  it("createGoogleProvider forces the Google account chooser", async () => {
    const { createGoogleProvider } = await import("./auth.js");
    createGoogleProvider();
    expect(setCustomParametersMock).toHaveBeenCalledWith({ prompt: "select_account" });
  });

  it("signInWithGooglePopup resolves with the signed-in user", async () => {
    signInWithPopupMock.mockResolvedValueOnce({ user: { uid: "u1" } });
    const { signInWithGooglePopup } = await import("./auth.js");
    await expect(signInWithGooglePopup()).resolves.toEqual({ uid: "u1" });
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });

  it("signInWithGooglePopup rejects with the original Firebase error", async () => {
    signInWithPopupMock.mockRejectedValueOnce({ code: "auth/popup-blocked" });
    const { signInWithGooglePopup } = await import("./auth.js");
    await expect(signInWithGooglePopup()).rejects.toMatchObject({ code: "auth/popup-blocked" });
  });

  it("signInWithGoogleRedirect delegates to signInWithRedirect with the account-chooser provider", async () => {
    signInWithRedirectMock.mockResolvedValueOnce(undefined);
    const { signInWithGoogleRedirect } = await import("./auth.js");
    await signInWithGoogleRedirect();
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
    expect(setCustomParametersMock).toHaveBeenCalledWith({ prompt: "select_account" });
  });

  it("completeGoogleRedirectSignIn resolves to the user when a redirect just completed", async () => {
    getRedirectResultMock.mockResolvedValueOnce({ user: { uid: "u2" } });
    const { completeGoogleRedirectSignIn } = await import("./auth.js");
    await expect(completeGoogleRedirectSignIn()).resolves.toEqual({ uid: "u2" });
  });

  it("completeGoogleRedirectSignIn resolves to null when there is no pending redirect", async () => {
    getRedirectResultMock.mockResolvedValueOnce(null);
    const { completeGoogleRedirectSignIn } = await import("./auth.js");
    await expect(completeGoogleRedirectSignIn()).resolves.toBeNull();
  });
});
