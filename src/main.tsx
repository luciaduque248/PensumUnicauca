import {
  StrictMode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "./index.css";
import "./styles/auth.css";

import App from "./App.tsx";

import {
  ApplicationAccessGate,
} from "./components/ApplicationAccessGate";

import {
  AcademicSyncGate,
} from "./components/AcademicSyncGate";

import {
  AuthProvider,
} from "./providers/AuthProvider";

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    <AuthProvider>
      <ApplicationAccessGate>
        <AcademicSyncGate>
          <App />
        </AcademicSyncGate>
      </ApplicationAccessGate>
    </AuthProvider>
  </StrictMode>,
);