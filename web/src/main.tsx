import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { AuthProvider } from "./hooks/useAuth.js";
import "./index.css";

// AuthProvider needs router context (useNavigate) to send a completed
// redirect sign-in to /inicio, so it must live inside BrowserRouter.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
