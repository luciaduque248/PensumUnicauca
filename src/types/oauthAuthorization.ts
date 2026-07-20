export interface OAuthConsentDetails {
    authorizationId: string;
    clientName: string;
    scopes: string[];
}

export type OAuthAuthorizationRequestResult =
    | {
        kind: "consent";
        details: OAuthConsentDetails;
    }
    | {
        kind: "redirect";
        redirectUrl: string;
    };