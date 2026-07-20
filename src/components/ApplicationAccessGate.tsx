/* eslint-disable react-hooks/set-state-in-effect */
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

import Swal from "sweetalert2";

import {
    LuArrowLeft,
    LuEye,
    LuEyeOff,
    LuBookOpen,
    LuCloud,
    LuGraduationCap,
    LuLock,
    LuLogIn,
    LuMail,
    LuShieldCheck,
    LuUser,
    LuUserPlus,
    LuVolume2,
} from "react-icons/lu";

import {
    AppAccessContext,
} from "../context/AppAccessContext";

import {
    useAuth,
} from "../hooks/useAuth";

import {
    signInWithEmail,
    signOut,
    signUpWithEmail,
} from "../services/authService";

import type {
    AppAccessContextValue,
} from "../types/appAccess";

interface ApplicationAccessGateProps {
    children: ReactNode;
}

type AccessPanel =
    | "options"
    | "sign-in"
    | "sign-up";

const GUEST_ACCESS_STORAGE_KEY =
    "pensum-access-mode";

const INTRO_DURATION_MS = 1900;

const getAuthenticationErrorCode = (
    error: unknown,
): string => {
    if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error)
    ) {
        return "";
    }

    const errorCode = (
        error as {
            code?: unknown;
        }
    ).code;

    return typeof errorCode === "string"
        ? errorCode
        : "";
};

const isInvalidCredentialsError = (
    error: unknown,
): boolean => {
    const errorCode =
        getAuthenticationErrorCode(
            error,
        );

    const errorMessage =
        error instanceof Error
            ? error.message.toLowerCase()
            : "";

    return (
        errorCode ===
        "invalid_credentials" ||
        errorMessage.includes(
            "invalid login credentials",
        )
    );
};

const GUEST_INFORMATION_HTML = `
    <div class="auth-guest-notice">
        <p>Los datos permanecen únicamente en este navegador.</p>
        <p>No se sincronizan entre dispositivos.</p>
        <p>Pueden perderse al borrar los datos del navegador.</p>
        <p>Alexa no está disponible en modo invitado.</p>
    </div>
`;

const getAuthenticationErrorMessage = (
    error: unknown,
): string => {
    const originalMessage =
        error instanceof Error
            ? error.message
            : "No fue posible completar la solicitud.";

    const normalizedMessage =
        originalMessage.toLowerCase();

    if (
        isInvalidCredentialsError(
            error,
        )
    ) {
        return "No pudimos verificar una combinación válida de correo y contraseña. Revisa los datos o crea una cuenta si todavía no estás registrado.";
    }

    if (
        normalizedMessage.includes(
            "email not confirmed",
        )
    ) {
        return "Debes confirmar tu correo electrónico antes de iniciar sesión.";
    }

    if (
        normalizedMessage.includes(
            "user already registered",
        )
    ) {
        return "Ya existe una cuenta registrada con este correo electrónico.";
    }

    if (
        normalizedMessage.includes(
            "password should be at least",
        )
    ) {
        return "La contraseña no cumple con la longitud mínima requerida.";
    }

    if (
        normalizedMessage.includes(
            "email rate limit exceeded",
        )
    ) {
        return "Se han realizado demasiadas solicitudes. Espera unos minutos antes de intentarlo nuevamente.";
    }

    if (
        normalizedMessage.includes(
            "unable to validate email address",
        )
    ) {
        return "El correo electrónico ingresado no es válido.";
    }

    return originalMessage;
};

const cleanCurrentView = (): void => {
    const url =
        new URL(
            window.location.href,
        );

    url.searchParams.delete(
        "view",
    );

    window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
    );
};

const showAuthenticationError =
    async (
        error: unknown,
    ): Promise<void> => {
        await Swal.fire({
            icon: "error",
            title:
                "No fue posible continuar",
            text:
                getAuthenticationErrorMessage(
                    error,
                ),
            confirmButtonText:
                "Entendido",
            confirmButtonColor:
                "#6366f1",
            background:
                "#0f172a",
            color:
                "#e2e8f0",
            customClass: {
                popup:
                    "auth-swal-popup",
                confirmButton:
                    "auth-swal-confirm",
            },
        });
    };

const AlexaCompatibilityBadge =
    () => {
        const [
            isLogoLoaded,
            setIsLogoLoaded,
        ] = useState(false);

        return (
            <div className="access-alexa">
                <span className="access-alexa__icon">
                    <LuVolume2
                        className={
                            isLogoLoaded
                                ? "access-alexa__fallback access-alexa__fallback--hidden"
                                : "access-alexa__fallback"
                        }
                        aria-hidden="true"
                    />

                    <img
                        className={
                            isLogoLoaded
                                ? "access-alexa__image access-alexa__image--visible"
                                : "access-alexa__image"
                        }
                        src="/alexa-logo.png"
                        alt=""
                        onLoad={() =>
                            setIsLogoLoaded(
                                true,
                            )
                        }
                        onError={() =>
                            setIsLogoLoaded(
                                false,
                            )
                        }
                    />
                </span>

                <span className="access-alexa__copy">
                    <strong>
                        Compatible con Alexa
                    </strong>

                    <small>
                        La vinculación estará disponible para cuentas registradas.
                    </small>
                </span>
            </div>
        );
    };

const AccessSplashScreen =
    () => {
        return (
            <div className="access-gate access-gate--splash">
                <div
                    className="access-gate__grid"
                    aria-hidden="true"
                />

                <span
                    className="access-gate__orb access-gate__orb--one"
                    aria-hidden="true"
                />

                <span
                    className="access-gate__orb access-gate__orb--two"
                    aria-hidden="true"
                />

                <div className="access-splash">
                    <span className="access-splash__logo">
                        <LuGraduationCap
                            aria-hidden="true"
                        />
                    </span>

                    <p className="access-splash__eyebrow">
                        Universidad del Cauca
                    </p>

                    <h1>
                        Mi pensum interactivo
                    </h1>

                    <p className="access-splash__description">
                        Ingeniería Electrónica y Telecomunicaciones
                    </p>

                    <div
                        className="access-splash__loader"
                        aria-label="Cargando aplicación"
                    >
                        <span />
                    </div>
                </div>
            </div>
        );
    };

interface AccessPortalProps {
    authInitializationError:
    string | null;

    onGuestAccess:
    () => Promise<void>;
}

const AccessPortal = ({
    authInitializationError,
    onGuestAccess,
}: AccessPortalProps) => {
    const [
        activePanel,
        setActivePanel,
    ] =
        useState<AccessPanel>(
            "options",
        );

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
        passwordConfirmation,
        setPasswordConfirmation,
    ] =
        useState("");

    const [
        isSubmitting,
        setIsSubmitting,
    ] =
        useState(false);

    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);

    const [
        showPasswordConfirmation,
        setShowPasswordConfirmation,
    ] =
        useState(false);

    const resetPasswords =
        (): void => {
            setPassword("");
            setPasswordConfirmation("");
            setShowPassword(false);
            setShowPasswordConfirmation(
                false,
            );
        };

    const returnToOptions =
        (): void => {
            resetPasswords();
            setActivePanel(
                "options",
            );
        };

    const openSignIn =
        (): void => {
            resetPasswords();
            setActivePanel(
                "sign-in",
            );
        };

    const openSignUp =
        (): void => {
            resetPasswords();
            setActivePanel(
                "sign-up",
            );
        };

    const handleSignIn =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ): Promise<void> => {
            event.preventDefault();

            if (
                email.trim() === "" ||
                password === ""
            ) {
                await Swal.fire({
                    icon:
                        "warning",
                    title:
                        "Completa los campos",
                    text:
                        "Ingresa tu correo electrónico y tu contraseña.",
                    confirmButtonText:
                        "Entendido",
                    confirmButtonColor:
                        "#6366f1",
                    background:
                        "#0f172a",
                    color:
                        "#e2e8f0",
                    customClass: {
                        popup:
                            "auth-swal-popup",
                    },
                });

                return;
            }

            setIsSubmitting(
                true,
            );

            try {
                cleanCurrentView();

                await signInWithEmail(
                    email,
                    password,
                );
            } catch (error) {
                if (
                    isInvalidCredentialsError(
                        error,
                    )
                ) {
                    const result =
                        await Swal.fire({
                            icon: "error",
                            title:
                                "No fue posible iniciar sesión",
                            text:
                                "No pudimos verificar una combinación válida de correo y contraseña. Revisa los datos. Si todavía no tienes cuenta, puedes crearla.",
                            showDenyButton:
                                true,
                            confirmButtonText:
                                "Revisar datos",
                            denyButtonText:
                                "Crear cuenta",
                            confirmButtonColor:
                                "#6366f1",
                            denyButtonColor:
                                "#7c3aed",
                            background:
                                "#0f172a",
                            color:
                                "#e2e8f0",
                            reverseButtons:
                                true,
                            customClass: {
                                popup:
                                    "auth-swal-popup",
                                confirmButton:
                                    "auth-swal-confirm",
                            },
                        });

                    if (
                        result.isDenied
                    ) {
                        resetPasswords();

                        setActivePanel(
                            "sign-up",
                        );
                    }
                } else {
                    await showAuthenticationError(
                        error,
                    );
                }
            } finally {
                setIsSubmitting(
                    false,
                );
            }
        };

    const handleSignUp =
        async (
            event:
                FormEvent<HTMLFormElement>,
        ): Promise<void> => {
            event.preventDefault();

            if (
                email.trim() === "" ||
                password === "" ||
                passwordConfirmation === ""
            ) {
                await Swal.fire({
                    icon:
                        "warning",
                    title:
                        "Completa los campos",
                    text:
                        "Debes ingresar el correo y las dos contraseñas.",
                    confirmButtonText:
                        "Entendido",
                    confirmButtonColor:
                        "#6366f1",
                    background:
                        "#0f172a",
                    color:
                        "#e2e8f0",
                    customClass: {
                        popup:
                            "auth-swal-popup",
                    },
                });

                return;
            }

            if (
                password.length < 8
            ) {
                await Swal.fire({
                    icon:
                        "warning",
                    title:
                        "Contraseña muy corta",
                    text:
                        "La contraseña debe tener al menos 8 caracteres.",
                    confirmButtonText:
                        "Corregir",
                    confirmButtonColor:
                        "#6366f1",
                    background:
                        "#0f172a",
                    color:
                        "#e2e8f0",
                    customClass: {
                        popup:
                            "auth-swal-popup",
                    },
                });

                return;
            }

            if (
                password !==
                passwordConfirmation
            ) {
                await Swal.fire({
                    icon:
                        "warning",
                    title:
                        "Las contraseñas no coinciden",
                    text:
                        "Escribe nuevamente la confirmación de la contraseña.",
                    confirmButtonText:
                        "Corregir",
                    confirmButtonColor:
                        "#6366f1",
                    background:
                        "#0f172a",
                    color:
                        "#e2e8f0",
                    customClass: {
                        popup:
                            "auth-swal-popup",
                    },
                });

                return;
            }

            setIsSubmitting(
                true,
            );

            try {
                cleanCurrentView();

                const result =
                    await signUpWithEmail(
                        email,
                        password,
                    );

                if (
                    result
                        .requiresEmailConfirmation
                ) {
                    await Swal.fire({
                        icon:
                            "success",
                        title:
                            "Revisa tu correo",
                        text:
                            "Te enviamos un enlace para confirmar la cuenta. Después de confirmarla podrás iniciar sesión.",
                        confirmButtonText:
                            "Ir a iniciar sesión",
                        confirmButtonColor:
                            "#6366f1",
                        background:
                            "#0f172a",
                        color:
                            "#e2e8f0",
                        customClass: {
                            popup:
                                "auth-swal-popup",
                        },
                    });

                    resetPasswords();

                    setActivePanel(
                        "sign-in",
                    );
                }
            } catch (error) {
                await showAuthenticationError(
                    error,
                );
            } finally {
                setIsSubmitting(
                    false,
                );
            }
        };

    return (
        <div className="access-gate">
            <div
                className="access-gate__grid"
                aria-hidden="true"
            />

            <span
                className="access-gate__orb access-gate__orb--one"
                aria-hidden="true"
            />

            <span
                className="access-gate__orb access-gate__orb--two"
                aria-hidden="true"
            />

            <main className="access-portal">
                <section className="access-portal__presentation">
                    <span className="access-portal__brand">
                        <LuGraduationCap
                            aria-hidden="true"
                        />
                    </span>

                    <p className="access-portal__eyebrow">
                        Universidad del Cauca
                    </p>

                    <h1>
                        Tu carrera, organizada en un solo lugar
                    </h1>

                    <p className="access-portal__description">
                        Consulta tu avance, horario, notas, prerrequisitos,
                        repitencias y hoja de vida académica.
                    </p>

                    <div className="access-portal__features">
                        <span>
                            <LuBookOpen
                                aria-hidden="true"
                            />
                            Pensum y progreso
                        </span>

                        <span>
                            <LuCloud
                                aria-hidden="true"
                            />
                            Cuenta opcional
                        </span>

                        <span>
                            <LuShieldCheck
                                aria-hidden="true"
                            />
                            Información privada
                        </span>
                    </div>
                </section>

                <section className="access-card">
                    <AlexaCompatibilityBadge />

                    {authInitializationError && (
                        <div
                            className="access-card__error"
                            role="alert"
                        >
                            <strong>
                                No fue posible comprobar la sesión.
                            </strong>

                            <span>
                                Puedes continuar como invitado o intentarlo nuevamente.
                            </span>
                        </div>
                    )}

                    {activePanel ===
                        "options" && (
                            <>
                                <div className="access-card__heading">
                                    <span>
                                        Acceso
                                    </span>

                                    <h2>
                                        ¿Cómo deseas ingresar?
                                    </h2>

                                    <p>
                                        Puedes usar la aplicación localmente o crear una cuenta.
                                    </p>
                                </div>

                                <div className="access-options">
                                    <button
                                        className="access-option access-option--primary"
                                        type="button"
                                        onClick={
                                            openSignIn
                                        }
                                    >
                                        <span className="access-option__icon">
                                            <LuLogIn
                                                aria-hidden="true"
                                            />
                                        </span>

                                        <span className="access-option__copy">
                                            <strong>
                                                Iniciar sesión
                                            </strong>

                                            <small>
                                                Accede con una cuenta existente.
                                            </small>
                                        </span>
                                    </button>

                                    <button
                                        className="access-option access-option--secondary"
                                        type="button"
                                        onClick={
                                            openSignUp
                                        }
                                    >
                                        <span className="access-option__icon">
                                            <LuUserPlus
                                                aria-hidden="true"
                                            />
                                        </span>

                                        <span className="access-option__copy">
                                            <strong>
                                                Crear cuenta
                                            </strong>

                                            <small>
                                                Prepara la sincronización y Alexa.
                                            </small>
                                        </span>
                                    </button>

                                    <button
                                        className="access-option access-option--guest"
                                        type="button"
                                        onClick={() =>
                                            void onGuestAccess()
                                        }
                                    >
                                        <span className="access-option__icon">
                                            <LuUser
                                                aria-hidden="true"
                                            />
                                        </span>

                                        <span className="access-option__copy">
                                            <strong>
                                                Modo invitado
                                            </strong>

                                            <small>
                                                Usa el pensum sin crear una cuenta.
                                            </small>
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}

                    {activePanel ===
                        "sign-in" && (
                            <>
                                <button
                                    className="access-card__back"
                                    type="button"
                                    onClick={
                                        returnToOptions
                                    }
                                >
                                    <LuArrowLeft
                                        aria-hidden="true"
                                    />
                                    Volver
                                </button>

                                <div className="access-card__heading">
                                    <span>
                                        Cuenta
                                    </span>

                                    <h2>
                                        Iniciar sesión
                                    </h2>

                                    <p>
                                        Ingresa con el correo que registraste en Mi pensum.
                                    </p>
                                </div>

                                <form
                                    className="access-form"
                                    onSubmit={
                                        handleSignIn
                                    }
                                >
                                    <label className="access-field">
                                        <span>
                                            Correo electrónico
                                        </span>

                                        <div className="access-field__control">
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
                                                disabled={
                                                    isSubmitting
                                                }
                                            />
                                        </div>
                                    </label>

                                    {/* Iniciar sesion */}
                                    <label className="access-field">
                                        <span>
                                            Contraseña
                                        </span>

                                        <div className="access-field__control">
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
                                                disabled={
                                                    isSubmitting
                                                }
                                            />

                                            <button
                                                className="access-field__toggle"
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
                                                aria-pressed={
                                                    showPassword
                                                }
                                                disabled={
                                                    isSubmitting
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

                                    <button
                                        className="access-form__submit"
                                        type="submit"
                                        disabled={
                                            isSubmitting
                                        }
                                        aria-busy={
                                            isSubmitting
                                        }
                                    >
                                        {isSubmitting && (
                                            <span
                                                className="access-form__spinner"
                                                aria-hidden="true"
                                            />
                                        )}

                                        {isSubmitting
                                            ? "Iniciando sesión..."
                                            : "Iniciar sesión"}
                                    </button>
                                </form>

                                <button
                                    className="access-form__switch"
                                    type="button"
                                    onClick={
                                        openSignUp
                                    }
                                >
                                    ¿No tienes cuenta?{" "}
                                    <strong>
                                        Crear cuenta
                                    </strong>
                                </button>
                            </>
                        )}

                    {activePanel ===
                        "sign-up" && (
                            <>
                                <button
                                    className="access-card__back"
                                    type="button"
                                    onClick={
                                        returnToOptions
                                    }
                                >
                                    <LuArrowLeft
                                        aria-hidden="true"
                                    />
                                    Volver
                                </button>

                                <div className="access-card__heading">
                                    <span>
                                        Registro
                                    </span>

                                    <h2>
                                        Crear cuenta
                                    </h2>

                                    <p>
                                        La cuenta será necesaria para sincronizar tus datos y vincular Alexa.
                                    </p>
                                </div>

                                <form
                                    className="access-form"
                                    onSubmit={
                                        handleSignUp
                                    }
                                >
                                    <label className="access-field">
                                        <span>
                                            Correo electrónico
                                        </span>

                                        <div className="access-field__control">
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
                                                disabled={
                                                    isSubmitting
                                                }
                                            />
                                        </div>
                                    </label>

                                    <label className="access-field">
                                        <span>
                                            Contraseña
                                        </span>

                                        <div className="access-field__control">
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
                                                minLength={
                                                    8
                                                }
                                                autoComplete="new-password"
                                                placeholder="Mínimo 8 caracteres"
                                                disabled={
                                                    isSubmitting
                                                }
                                            />

                                            <button
                                                className="access-field__toggle"
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
                                                aria-pressed={
                                                    showPassword
                                                }
                                                disabled={
                                                    isSubmitting
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

                                        <p
                                            className={`access-field__requirement ${password.length >= 8
                                                ? "access-field__requirement--success"
                                                : ""
                                                }`}
                                        >
                                            <LuShieldCheck
                                                aria-hidden="true"
                                            />

                                            <span>
                                                Debe tener mínimo 8 caracteres.
                                            </span>
                                        </p>
                                    </label>

                                    <label className="access-field">
                                        <span>
                                            Confirmar contraseña
                                        </span>

                                        <div className="access-field__control">
                                            <LuLock
                                                aria-hidden="true"
                                            />

                                            <input
                                                type={
                                                    showPasswordConfirmation
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={
                                                    passwordConfirmation
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    setPasswordConfirmation(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                                }
                                                minLength={
                                                    8
                                                }
                                                autoComplete="new-password"
                                                placeholder="Repite la contraseña"
                                                disabled={
                                                    isSubmitting
                                                }
                                            />

                                            <button
                                                className="access-field__toggle"
                                                type="button"
                                                onClick={() =>
                                                    setShowPasswordConfirmation(
                                                        (
                                                            currentValue,
                                                        ) =>
                                                            !currentValue,
                                                    )
                                                }
                                                aria-label={
                                                    showPasswordConfirmation
                                                        ? "Ocultar confirmación de contraseña"
                                                        : "Mostrar confirmación de contraseña"
                                                }
                                                aria-pressed={
                                                    showPasswordConfirmation
                                                }
                                                disabled={
                                                    isSubmitting
                                                }
                                            >
                                                {showPasswordConfirmation ? (
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

                                        {passwordConfirmation !==
                                            "" && (
                                                <p
                                                    className={`access-field__requirement ${password ===
                                                            passwordConfirmation
                                                            ? "access-field__requirement--success"
                                                            : "access-field__requirement--error"
                                                        }`}
                                                >
                                                    <LuShieldCheck
                                                        aria-hidden="true"
                                                    />

                                                    <span>
                                                        {password ===
                                                            passwordConfirmation
                                                            ? "Las contraseñas coinciden."
                                                            : "Las contraseñas no coinciden."}
                                                    </span>
                                                </p>
                                            )}
                                    </label>

                                    <button
                                        className="access-form__submit"
                                        type="submit"
                                        disabled={
                                            isSubmitting
                                        }
                                        aria-busy={
                                            isSubmitting
                                        }
                                    >
                                        {isSubmitting && (
                                            <span
                                                className="access-form__spinner"
                                                aria-hidden="true"
                                            />
                                        )}

                                        {isSubmitting
                                            ? "Creando cuenta..."
                                            : "Crear cuenta"}
                                    </button>
                                </form>

                                <button
                                    className="access-form__switch"
                                    type="button"
                                    onClick={
                                        openSignIn
                                    }
                                >
                                    ¿Ya tienes cuenta?{" "}
                                    <strong>
                                        Iniciar sesión
                                    </strong>
                                </button>
                            </>
                        )}
                </section>
            </main>
        </div>
    );
};

export const ApplicationAccessGate = ({
    children,
}: ApplicationAccessGateProps) => {
    const {
        user,
        isAuthLoading,
        authInitializationError,
    } = useAuth();

    const [
        hasFinishedIntro,
        setHasFinishedIntro,
    ] =
        useState(false);

    const [
        hasGuestAccess,
        setHasGuestAccess,
    ] =
        useState(
            () =>
                localStorage.getItem(
                    GUEST_ACCESS_STORAGE_KEY,
                ) === "guest",
        );

    useEffect(() => {
        const timer =
            window.setTimeout(
                () => {
                    setHasFinishedIntro(
                        true,
                    );
                },
                INTRO_DURATION_MS,
            );

        return () => {
            window.clearTimeout(
                timer,
            );
        };
    }, []);

    useEffect(() => {
        if (!user) {
            return;
        }

        localStorage.removeItem(
            GUEST_ACCESS_STORAGE_KEY,
        );

        setHasGuestAccess(
            false,
        );
    }, [user]);

    const showGuestInformation =
        useCallback(
            async (): Promise<void> => {
                await Swal.fire({
                    icon:
                        "info",
                    title:
                        "Modo invitado",
                    html:
                        GUEST_INFORMATION_HTML,
                    confirmButtonText:
                        "Entendido",
                    confirmButtonColor:
                        "#6366f1",
                    background:
                        "#0f172a",
                    color:
                        "#e2e8f0",
                    customClass: {
                        popup:
                            "auth-swal-popup",
                        htmlContainer:
                            "auth-swal-content",
                        confirmButton:
                            "auth-swal-confirm",
                    },
                });
            },
            [],
        );

    const activateGuestAccess =
        useCallback(
            async (): Promise<void> => {
                const result =
                    await Swal.fire({
                        icon:
                            "info",
                        title:
                            "Modo invitado",
                        html:
                            GUEST_INFORMATION_HTML,
                        showCancelButton:
                            true,
                        confirmButtonText:
                            "Continuar como invitado",
                        cancelButtonText:
                            "Volver",
                        confirmButtonColor:
                            "#6366f1",
                        cancelButtonColor:
                            "#334155",
                        background:
                            "#0f172a",
                        color:
                            "#e2e8f0",
                        reverseButtons:
                            true,
                        customClass: {
                            popup:
                                "auth-swal-popup",
                            htmlContainer:
                                "auth-swal-content",
                            confirmButton:
                                "auth-swal-confirm",
                            cancelButton:
                                "auth-swal-cancel",
                        },
                    });

                if (
                    !result.isConfirmed
                ) {
                    return;
                }

                cleanCurrentView();

                localStorage.setItem(
                    GUEST_ACCESS_STORAGE_KEY,
                    "guest",
                );

                setHasGuestAccess(
                    true,
                );
            },
            [],
        );

    const leaveCurrentAccess =
        useCallback(
            async (): Promise<void> => {
                if (user) {
                    const result =
                        await Swal.fire({
                            icon:
                                "question",
                            title:
                                "¿Cerrar sesión?",
                            text:
                                "Volverás a la pantalla de acceso.",
                            showCancelButton:
                                true,
                            confirmButtonText:
                                "Sí, cerrar sesión",
                            cancelButtonText:
                                "Cancelar",
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

                    try {
                        await signOut();

                        localStorage.removeItem(
                            GUEST_ACCESS_STORAGE_KEY,
                        );

                        cleanCurrentView();
                    } catch (error) {
                        await showAuthenticationError(
                            error,
                        );
                    }

                    return;
                }

                const result =
                    await Swal.fire({
                        icon:
                            "question",
                        title:
                            "¿Salir del modo invitado?",
                        text:
                            "Tu progreso local no se eliminará. Volverás a la pantalla de acceso.",
                        showCancelButton:
                            true,
                        confirmButtonText:
                            "Cambiar acceso",
                        cancelButtonText:
                            "Seguir como invitado",
                        confirmButtonColor:
                            "#6366f1",
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

                localStorage.removeItem(
                    GUEST_ACCESS_STORAGE_KEY,
                );

                setHasGuestAccess(
                    false,
                );

                cleanCurrentView();
            },
            [
                user,
            ],
        );

    const contextValue =
        useMemo<
            AppAccessContextValue
        >(
            () => ({
                accessMode:
                    user
                        ? "authenticated"
                        : "guest",

                accountEmail:
                    user?.email ??
                    null,

                leaveCurrentAccess,

                showGuestInformation,
            }),
            [
                user,
                leaveCurrentAccess,
                showGuestInformation,
            ],
        );

    if (
        !hasFinishedIntro ||
        isAuthLoading
    ) {
        return (
            <AccessSplashScreen />
        );
    }

    if (
        !user &&
        !hasGuestAccess
    ) {
        return (
            <AccessPortal
                authInitializationError={
                    authInitializationError
                }
                onGuestAccess={
                    activateGuestAccess
                }
            />
        );
    }

    return (
        <AppAccessContext.Provider
            value={contextValue}
        >
            {children}
        </AppAccessContext.Provider>
    );
};