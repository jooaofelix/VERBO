import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/BottomNav.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { TopBar } from "./components/TopBar.js";
import { About } from "./routes/About.js";
import { CompareVersions } from "./routes/CompareVersions.js";
import { ForgotPassword } from "./routes/ForgotPassword.js";
import { Library } from "./routes/Library.js";
import { Login } from "./routes/Login.js";
import { NewAnalysis } from "./routes/NewAnalysis.js";
import { Onboarding } from "./routes/Onboarding.js";
import { Signup } from "./routes/Signup.js";
import { VersionView } from "./routes/VersionView.js";

const ONBOARDING_KEY = "verbo-e-cancao:onboarding-seen";
const AUTH_ROUTES = ["/entrar", "/cadastro", "/recuperar-senha"];

export default function App() {
  const location = useLocation();
  const [onboardingSeen, setOnboardingSeen] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === "1"
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!onboardingSeen) {
    return (
      <Onboarding
        onDone={() => {
          localStorage.setItem(ONBOARDING_KEY, "1");
          setOnboardingSeen(true);
        }}
      />
    );
  }

  const isAuthRoute = AUTH_ROUTES.includes(location.pathname);

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/entrar" element={<Login />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/recuperar-senha" element={<ForgotPassword />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1 pb-24">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nova"
            element={
              <ProtectedRoute>
                <NewAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/musicas/:songId/versoes/:versionId"
            element={
              <ProtectedRoute>
                <VersionView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/musicas/:songId/comparar"
            element={
              <ProtectedRoute>
                <CompareVersions />
              </ProtectedRoute>
            }
          />
          <Route path="/sobre" element={<About />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
