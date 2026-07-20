/* eslint-disable react-hooks/set-state-in-effect */
import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuArrowLeft,
    LuBookOpen,
    LuCheck,
    LuEye,
    LuEyeOff,
    LuGraduationCap,
    LuLink,
    LuLock,
    LuMail,
    LuShieldCheck,
    LuVolume2,
    LuX,
} from "react-icons/lu";

import {
    useAuth,
} from "../hooks/useAuth";

import {
    signInWithEmail,
} from "../services/authService";

import {
    approveOAuthAuthorization,
    denyOAuthAuthorization,
    getOAuthAuthorizationRequest,
} from "../services/oauthAuthorizationService";

import type {
    OAuthConsentDetails,
} from "../types/oauthAuthorization";

type OAuthConsentStatus =
    | "loading"
    | "login"
    | "consent"
    | "processing"
    | "error";

const isValidEmail = (
    email: string,
): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
    );
};

const getErrorMessage = (
    error: unknown,
): string => {
    const message =
        error instanceof Error
            ? error.message
            : "No fue posible completar la solicitud.";

    const normalizedMessage =
        message.toLowerCase();

    if (
        normalizedMessage.includes(
            "invalid login credentials",
        )
    ) {
        return "El correo electrónico o la contraseña no son correctos.";
    }

    if (
        normalizedMessage.includes(
            "email not confirmed",
        )
    ) {
        return "Debes confirmar tu correo electrónico antes de vincular Alexa.";
    }

    if (
        normalizedMessage.includes(
            "authorization",
        ) &&
        normalizedMessage.includes(
            "expired",
        )
    ) {
        return "La solicitud de vinculación venció. Inicia nuevamente el proceso desde Alexa.";
    }

    return message;
};

const getScopeLabel = (
    scope: string,
): string => {
    switch (scope) {
        case "openid":
            return "Identificar tu cuenta.";

        case "email":
            return "Consultar el correo asociado.";

        case "profile":
            return "Consultar los datos básicos del perfil.";

        default:
            return scope;
    }
};

function OAuthConsentPage() {
    const {
        user,
        isAuthLoading,
    } = useAuth();

    const [
        status,
        setStatus,
    ] =
        useState<OAuthConsentStatus>(
            "loading",
        );

    const [
        consentDetails,
        setConsentDetails,
    ] =
        useState<
            OAuthConsentDetails | null
        >(null);

    const [
        email,
        setEmail,
    ] =
        useState("");

    const [
        password,
        setPassword,
    ] =
        useState("");

    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);

    const [
        loginError,
        setLoginError,
    ] =
        useState<string | null>(
            null,
        );

    const [
        pageError,
        setPageError,
    ] =
        useState<string | null>(
            null,
        );

    const authorizationId =
        new URLSearchParams(
            window.location.search,
        ).get(
            "authorization_id",
        );

    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        if (!authorizationId) {
            setPageError(
                "No se recibió una solicitud válida de vinculación con Alexa.",
            );

            setStatus(
                "error",
            );

            return;
        }

        if (!user) {
            setStatus(
                "login",
            );

            return;
        }

        let isActive =
            true;

        setStatus(
            "loading",
        );

        const loadAuthorizationRequest =
            async (): Promise<void> => {
                try {
                    const result =
                        await getOAuthAuthorizationRequest(
                            authorizationId,
                        );

                    if (!isActive) {
                        return;
                    }

                    if (
                        result.kind ===
                        "redirect"
                    ) {
                        window.location.replace(
                            result.redirectUrl,
                        );

                        return;
                    }

                    setConsentDetails(
                        result.details,
                    );

                    setPageError(
                        null,
                    );

                    setStatus(
                        "consent",
                    );
                } catch (error) {
                    if (!isActive) {
                        return;
                    }

                    setPageError(
                        getErrorMessage(
                            error,
                        ),
                    );

                    setStatus(
                        "error",
                    );
                }
            };

        void loadAuthorizationRequest();

        return () => {
            isActive =
                false;
        };
    }, [
        authorizationId,
        user,
        isAuthLoading,
    ]);

    const handleSignIn =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ): Promise<void> => {
            event.preventDefault();

            setLoginError(
                null,
            );

            const normalizedEmail =
                email.trim();

            if (
                normalizedEmail ===
                "" ||
                !isValidEmail(
                    normalizedEmail,
                )
            ) {
                setLoginError(
                    "Ingresa un correo electrónico válido.",
                );

                return;
            }

            if (
                password === ""
            ) {
                setLoginError(
                    "Ingresa tu contraseña.",
                );

                return;
            }

            setStatus(
                "processing",
            );

            try {
                await signInWithEmail(
                    normalizedEmail,
                    password,
                );

                setStatus(
                    "loading",
                );
            } catch (error) {
                setLoginError(
                    getErrorMessage(
                        error,
                    ),
                );

                setStatus(
                    "login",
                );
            }
        };

    const handleApprove =
        async (): Promise<void> => {
            if (
                !consentDetails
            ) {
                return;
            }

            setPageError(
                null,
            );

            setStatus(
                "processing",
            );

            try {
                const redirectUrl =
                    await approveOAuthAuthorization(
                        consentDetails
                            .authorizationId,
                    );

                window.location.replace(
                    redirectUrl,
                );
            } catch (error) {
                setPageError(
                    getErrorMessage(
                        error,
                    ),
                );

                setStatus(
                    "consent",
                );
            }
        };

    const handleDeny =
        async (): Promise<void> => {
            if (
                !consentDetails
            ) {
                return;
            }

            const result =
                await Swal.fire({
                    icon:
                        "question",

                    title:
                        "¿Cancelar la vinculación?",

                    text:
                        "Alexa no podrá consultar tu información académica.",

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Sí, cancelar",

                    cancelButtonText:
                        "Volver",

                    confirmButtonColor:
                        "#dc2626",

                    cancelButtonColor:
                        "#475569",

                    background:
                        "#0f172a",

                    color:
                        "#e2e8f0",

                    reverseButtons:
                        true,

                    customClass: {
                        popup:
                            "auth-swal-popup",
                    },
                });

            if (
                !result.isConfirmed
            ) {
                return;
            }

            setStatus(
                "processing",
            );

            try {
                const redirectUrl =
                    await denyOAuthAuthorization(
                        consentDetails
                            .authorizationId,
                    );

                window.location.replace(
                    redirectUrl,
                );
            } catch (error) {
                setPageError(
                    getErrorMessage(
                        error,
                    ),
                );

                setStatus(
                    "consent",
                );
            }
        };

    if (
        status ===
        "loading" ||
        status ===
        "processing"
    ) {
        return (
            <main className="oauth-consent-page">
                <section className="oauth-consent-card oauth-consent-card--loading">
                    <span
                        className="oauth-consent-spinner"
                        aria-hidden="true"
                    />

                    <h1>
                        {status ===
                            "processing"
                            ? "Procesando autorización"
                            : "Preparando vinculación"}
                    </h1>

                    <p>
                        No cierres esta ventana.
                    </p>
                </section>
            </main>
        );
    }

    if (
        status ===
        "error"
    ) {
        return (
            <main className="oauth-consent-page">
                <section className="oauth-consent-card">
                    <span className="oauth-consent-brand">
                        <LuGraduationCap
                            aria-hidden="true"
                        />
                    </span>

                    <div className="oauth-consent-heading">
                        <span>
                            Mi pensum
                        </span>

                        <h1>
                            No fue posible vincular Alexa
                        </h1>

                        <p>
                            {pageError}
                        </p>
                    </div>

                    <button
                        className="oauth-consent-secondary-button"
                        type="button"
                        onClick={() => {
                            window.location.href =
                                "/";
                        }}
                    >
                        <LuArrowLeft
                            aria-hidden="true"
                        />

                        Volver a Mi pensum
                    </button>
                </section>
            </main>
        );
    }

    if (
        status ===
        "login"
    ) {
        return (
            <main className="oauth-consent-page">
                <section className="oauth-consent-card">
                    <div className="oauth-consent-connection">
                        <span className="oauth-consent-connection__app">
                            <LuVolume2
                                aria-hidden="true"
                            />
                        </span>

                        <span className="oauth-consent-connection__line" />

                        <span className="oauth-consent-connection__app">
                            <LuGraduationCap
                                aria-hidden="true"
                            />
                        </span>
                    </div>

                    <div className="oauth-consent-heading">
                        <span>
                            Vinculación con Alexa
                        </span>

                        <h1>
                            Inicia sesión en Mi pensum
                        </h1>

                        <p>
                            Usa una cuenta registrada y confirmada para continuar.
                        </p>
                    </div>

                    <form
                        className="oauth-consent-form"
                        onSubmit={
                            handleSignIn
                        }
                        noValidate
                    >
                        <label className="oauth-consent-field">
                            <span>
                                Correo electrónico
                            </span>

                            <div className="oauth-consent-field__control">
                                <LuMail
                                    aria-hidden="true"
                                />

                                <input
                                    type="email"
                                    value={
                                        email
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setEmail(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    autoComplete="email"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                        </label>

                        <label className="oauth-consent-field">
                            <span>
                                Contraseña
                            </span>

                            <div className="oauth-consent-field__control">
                                <LuLock
                                    aria-hidden="true"
                                />

                                <input
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={
                                        password
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setPassword(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    autoComplete="current-password"
                                    placeholder="Tu contraseña"
                                />

                                <button
                                    className="oauth-consent-password-toggle"
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(
                                            (
                                                currentValue,
                                            ) =>
                                                !currentValue,
                                        )
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Ocultar contraseña"
                                            : "Mostrar contraseña"
                                    }
                                >
                                    {showPassword ? (
                                        <LuEyeOff
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <LuEye
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            </div>
                        </label>

                        {loginError && (
                            <p
                                className="oauth-consent-error"
                                role="alert"
                            >
                                {
                                    loginError
                                }
                            </p>
                        )}

                        <button
                            className="oauth-consent-primary-button"
                            type="submit"
                        >
                            <LuLink
                                aria-hidden="true"
                            />

                            Iniciar sesión y continuar
                        </button>
                    </form>

                    <div className="oauth-consent-account-help">
                        <strong>
                            ¿Todavía no tienes cuenta?
                        </strong>

                        <p>
                            Crea y confirma tu cuenta desde la página principal de Mi pensum. Después inicia nuevamente la vinculación desde Alexa.
                        </p>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="oauth-consent-page">
            <section className="oauth-consent-card">
                <div className="oauth-consent-connection">
                    <span className="oauth-consent-connection__app">
                        <LuVolume2
                            aria-hidden="true"
                        />
                    </span>

                    <span className="oauth-consent-connection__line" />

                    <span className="oauth-consent-connection__app">
                        <LuGraduationCap
                            aria-hidden="true"
                        />
                    </span>
                </div>

                <div className="oauth-consent-heading">
                    <span>
                        Solicitud de acceso
                    </span>

                    <h1>
                        Vincular Alexa con Mi pensum
                    </h1>

                    <p>
                        <strong>
                            {consentDetails
                                ?.clientName ??
                                "Alexa"}
                        </strong>{" "}
                        solicita autorización para consultar tu información académica.
                    </p>
                </div>

                <div className="oauth-consent-account">
                    <span>
                        Cuenta actual
                    </span>

                    <strong>
                        {user?.email ??
                            "Usuario autenticado"}
                    </strong>
                </div>

                <div className="oauth-consent-permissions">
                    <h2>
                        Alexa podrá:
                    </h2>

                    <ul>
                        <li>
                            <LuCheck
                                aria-hidden="true"
                            />

                            Consultar tu progreso y créditos aprobados.
                        </li>

                        <li>
                            <LuCheck
                                aria-hidden="true"
                            />

                            Consultar tus materias, horario y próxima clase.
                        </li>

                        <li>
                            <LuCheck
                                aria-hidden="true"
                            />

                            Consultar tu promedio y situación académica.
                        </li>
                    </ul>
                </div>

                <div className="oauth-consent-security">
                    <LuShieldCheck
                        aria-hidden="true"
                    />

                    <span>
                        Alexa solo utilizará esta conexión para leer la información de tu propia cuenta. No modificará materias, notas ni repitencias.
                    </span>
                </div>

                {consentDetails &&
                    consentDetails
                        .scopes.length >
                    0 && (
                        <details className="oauth-consent-technical">
                            <summary>
                                Permisos técnicos
                            </summary>

                            <ul>
                                {consentDetails.scopes.map(
                                    (
                                        scope,
                                    ) => (
                                        <li
                                            key={
                                                scope
                                            }
                                        >
                                            {getScopeLabel(
                                                scope,
                                            )}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </details>
                    )}

                {pageError && (
                    <p
                        className="oauth-consent-error"
                        role="alert"
                    >
                        {pageError}
                    </p>
                )}

                <div className="oauth-consent-actions">
                    <button
                        className="oauth-consent-secondary-button"
                        type="button"
                        onClick={() =>
                            void handleDeny()
                        }
                    >
                        <LuX
                            aria-hidden="true"
                        />

                        No autorizar
                    </button>

                    <button
                        className="oauth-consent-primary-button"
                        type="button"
                        onClick={() =>
                            void handleApprove()
                        }
                    >
                        <LuBookOpen
                            aria-hidden="true"
                        />

                        Autorizar Alexa
                    </button>
                </div>
            </section>
        </main>
    );
}

export default OAuthConsentPage;