import { Firestore } from "@google-cloud/firestore";
import { ExternalAccountClient, GoogleAuth } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";

const PROJECT_ID = "mi-pensum-unicauca";
let services: { auth: { getUser(uid: string): Promise<{ uid: string; disabled: boolean }> }; db: Firestore } | undefined;

// Server only. Vercel uses federation; local checks can use private ADC.
export function getFirebaseServer() {
    if (services) return services;
    const projectId = process.env.GCP_PROJECT_ID ?? PROJECT_ID;
    if (projectId !== PROJECT_ID) throw new Error("Unexpected Firebase project.");
    let googleAuth: GoogleAuth;
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
    } else {
        googleAuth = new GoogleAuth({ projectId, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    }
    // Official Auth lookup API avoids an Admin SDK CommonJS/ESM incompatibility
    // in Vercel's loader. The service account only needs firebaseauth.users.get.
    services = { auth: { async getUser(uid) {
        if (!uid || uid.length > 128 || uid.includes("/")) throw new Error("Invalid Firebase UID.");
        const response = await googleAuth.request<{ users?: Array<{ localId?: string; disabled?: boolean }> }>({
            url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
            method: "POST", data: { localId: [uid] }, timeout: 15_000,
        });
        const user = response.data.users?.find(user => user.localId === uid);
        if (!user) throw Object.assign(new Error("Firebase account not found."), { code: "auth/user-not-found" });
        if (user.disabled !== undefined && typeof user.disabled !== "boolean") throw new Error("Invalid Firebase account state.");
        return { uid, disabled: user.disabled === true };
    }}, db: new Firestore({ projectId, auth: googleAuth }) };
    return services;
}
