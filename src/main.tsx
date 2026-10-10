import {StrictMode,} from "react";

import {createRoot,} from "react-dom/client";

import "./index.css";
import "./styles/auth.css";
import "./styles/oauth-consent.css";

import App from "./App.tsx";

import {AcademicSyncGate,} from "./components/AcademicSyncGate";

import {ApplicationAccessGate,} from "./components/ApplicationAccessGate";

import OAuthConsentPage from "./components/OAuthConsentPage";

import {AuthProvider,} from "./providers/AuthProvider";

import { usesFirebase } from "./lib/backendProvider";

const isOAuthConsentPage =
  window.location.pathname ===
  "/oauth/consent";

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    {usesFirebase ? (
      <aside className="firebase-preview-notice" aria-label="Versión de prueba">
        <strong>Versión de prueba.</strong> Usa una cuenta de prueba; las cuentas anteriores aún no se han transferido.
        Alexa sigue disponible en la <a href="https://pensum-unicauca.vercel.app">aplicación principal</a>.
      </aside>
    ) : null}
    <AuthProvider>
      {isOAuthConsentPage ? (
        <OAuthConsentPage />
      ) : (
        <ApplicationAccessGate>
          <AcademicSyncGate>
            <App />
          </AcademicSyncGate>
        </ApplicationAccessGate>
      )}
    </AuthProvider>
  </StrictMode>,
);