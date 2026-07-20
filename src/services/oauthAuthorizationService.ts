import {
    supabase,
} from "../lib/supabase";

import type {
    OAuthAuthorizationRequestResult,
    OAuthConsentDetails,
} from "../types/oauthAuthorization";

const isRecord = (
    value: unknown,
): value is Record<
    string,
    unknown
> => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
};

const getRedirectUrl = (
    value: unknown,
): string => {
    if (
        !isRecord(value) ||
        typeof value.redirect_url !==
        "string" ||
        value.redirect_url.trim() === ""
    ) {
        throw new Error(
            "Supabase no devolvió una dirección de redirección válida.",
        );
    }

    return value.redirect_url;
};

const getConsentDetails = (
    authorizationId: string,
    value: Record<
        string,
        unknown
    >,
): OAuthConsentDetails => {
    const client =
        isRecord(value.client)
            ? value.client
            : null;

    const clientName =
        client &&
            typeof client.name ===
            "string" &&
            client.name.trim() !== ""
            ? client.name
            : "Alexa";

    const scope =
        typeof value.scope ===
            "string"
            ? value.scope.trim()
            : "";

    const scopes =
        scope === ""
            ? []
            : scope
                .split(/\s+/)
                .filter(Boolean);

    return {
        authorizationId,
        clientName,
        scopes,
    };
};

export const getOAuthAuthorizationRequest =
    async (
        authorizationId: string,
    ): Promise<OAuthAuthorizationRequestResult> => {
        const {
            data,
            error,
        } =
            await supabase.auth.oauth
                .getAuthorizationDetails(
                    authorizationId,
                );

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "La solicitud de autorización no existe o ya venció.",
            );
        }

        const responseData:
            unknown = data;

        if (
            !isRecord(
                responseData,
            )
        ) {
            throw new Error(
                "La solicitud de autorización no tiene una estructura válida.",
            );
        }

        /*
         * Si no viene authorization_id,
         * el usuario ya había autorizado
         * anteriormente esta aplicación.
         */
        if (
            !(
                "authorization_id" in
                responseData
            )
        ) {
            return {
                kind:
                    "redirect",

                redirectUrl:
                    getRedirectUrl(
                        responseData,
                    ),
            };
        }

        return {
            kind:
                "consent",

            details:
                getConsentDetails(
                    authorizationId,
                    responseData,
                ),
        };
    };

export const approveOAuthAuthorization =
    async (
        authorizationId: string,
    ): Promise<string> => {
        const {
            data,
            error,
        } =
            await supabase.auth.oauth
                .approveAuthorization(
                    authorizationId,
                );

        if (error) {
            throw error;
        }

        return getRedirectUrl(
            data,
        );
    };

export const denyOAuthAuthorization =
    async (
        authorizationId: string,
    ): Promise<string> => {
        const {
            data,
            error,
        } =
            await supabase.auth.oauth
                .denyAuthorization(
                    authorizationId,
                );

        if (error) {
            throw error;
        }

        return getRedirectUrl(
            data,
        );
    };