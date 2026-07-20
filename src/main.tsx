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

const isOAuthConsentPage =
  window.location.pathname ===
  "/oauth/consent";

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
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