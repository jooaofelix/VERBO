import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/BottomNav.js";
import { TopBar } from "./components/TopBar.js";
import { About } from "./routes/About.js";
import { CompareVersions } from "./routes/CompareVersions.js";
import { Library } from "./routes/Library.js";
import { NewAnalysis } from "./routes/NewAnalysis.js";
import { Onboarding } from "./routes/Onboarding.js";
import { VersionView } from "./routes/VersionView.js";

const ONBOARDING_KEY = "verbo-e-cancao:onboarding-seen";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/nova" element={<NewAnalysis />} />
          <Route path="/musicas/:songId/versoes/:versionId" element={<VersionView />} />
          <Route path="/musicas/:songId/comparar" element={<CompareVersions />} />
          <Route path="/sobre" element={<About />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
