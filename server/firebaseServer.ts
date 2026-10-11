import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Firestore } from "@google-cloud/firestore";
import { ExternalAccountClient, GoogleAuth } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

const PROJECT_ID = "mi-pensum-unicauca";
let services: { auth: ReturnType<typeof getAuth>; db: Firestore } | undefined;

// Server only. Vercel uses federation; local checks can use private ADC.
export function getFirebaseServer() {
    if (services) return services;
    const projectId = process.env.GCP_PROJECT_ID ?? PROJECT_ID;
    if (projectId !== PROJECT_ID) throw new Error("Unexpected Firebase project.");
    let googleAuth: GoogleAuth;
    let credential;
    if (process.env.VERCEL) {
        const number = process.env.GCP_PROJECT_NUMBER;
        const pool = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
        const provider = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
        const email = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
        if (!number || !pool || !provider || !email) throw new Error("Firebase server federation is not configured.");
        const authClient = ExternalAccountClient.fromJSON({
            type: "external_account",
            audience: `//iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
            subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
            token_url: "https://sts.googleapis.com/v1/token",
            service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
            subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
        });
        if (!authClient) throw new Error("Invalid Firebase federation configuration.");
        authClient.scopes = ["https://www.googleapis.com/auth/cloud-platform"];
        googleAuth = new GoogleAuth({ authClient, projectId });
        credential = { async getAccessToken() {
            const result = await authClient.getAccessToken();
            if (!result.token) throw new Error("Firebase server authentication failed.");
            const expires = authClient.credentials.expiry_date ?? Date.now() + 300_000;
            return { access_token: result.token, expires_in: Math.max(1, Math.floor((expires - Date.now()) / 1000)) };
        }};
    } else {
        googleAuth = new GoogleAuth({ projectId, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
        credential = applicationDefault();
    }
    const app = getApps().find(app => app.name === "pensum-server") ??
        initializeApp({ projectId, credential }, "pensum-server");
    services = { auth: getAuth(app), db: new Firestore({ projectId, auth: googleAuth }) };
    return services;
}
