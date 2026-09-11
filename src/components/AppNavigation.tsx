import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    LuBookOpen,
    LuCalculator,
    LuCalendarDays,
    LuGraduationCap,
    LuHouse,
    LuLogOut,
    LuUser,
} from "react-icons/lu";

import "../styles/alexa-navigation.css";

import {
    useAppAccess,
} from "../hooks/useAppAccess";

export type AppView =
    | "home"
    | "academic-life"
    | "student-record"
    | "schedule"
    | "grades";

interface AppNavigationProps {
    currentView: AppView;
}

interface AlexaCommandSection {
    label: string;
    description: string;
    commands: string[];
    note?: string;
}

const navigationItems: Array<{
    view: AppView;
    label: string;
    icon: typeof LuHouse;
}> = [
    {
        view: "home",
        label: "Inicio",
        icon: LuHouse,
    },
    {
        view: "academic-life",
        label: "Vida académica",
        icon: LuBookOpen,
    },
    {
        view: "student-record",
        label: "Hoja de vida académica",
        icon: LuGraduationCap,
    },
    {
        view: "schedule",
        label: "Horario",
        icon: LuCalendarDays,
    },
    {
        view: "grades",
        label: "Notas",
        icon: LuCalculator,
    },
];

const alexaCommandsByView: Record<AppView, AlexaCommandSection> = {
    home: {
        label: "Inicio",
        description:
            "Consultas generales que puedes hacer después de abrir la skill.",
        commands: [
            "cuál es mi progreso",
            "cuántos créditos he aprobado",
            "qué materias tengo en curso",
            "qué materias tengo matriculadas",
            "cuál es mi promedio",
            "cuál es mi situación académica",
        ],
    },
    "academic-life": {
        label: "Vida académica",
        description:
            "Consulta tu avance, créditos y materias actuales.",
        commands: [
            "cuál es mi progreso",
            "cuánto llevo de la carrera",
            "qué porcentaje llevo",
            "cuántos créditos he aprobado",
            "cuántos créditos me faltan",
            "qué materias tengo en curso",
            "qué materias tengo matriculadas",
        ],
    },
    "student-record": {
        label: "Hoja de vida académica",
        description:
            "Consulta tu situación reglamentaria y las restricciones registradas.",
        commands: [
            "cuál es mi situación académica",
            "dime mi situación académica",
            "tengo alguna restricción académica",
            "estoy en bajo rendimiento",
            "tengo matrícula condicional",
            "puedo continuar estudiando",
        ],
    },
    schedule: {
        label: "Horario",
        description:
            "Pregunta por tu horario sincronizado y por la siguiente clase.",
        commands: [
            "cuál es mi horario",
            "qué clases tengo hoy",
            "qué materias tengo hoy",
            "cuál es mi próxima clase",
            "qué clase tengo después",
            "a qué hora es mi próxima clase",
            "cuándo es mi siguiente clase",
        ],
    },
    grades: {
        label: "Notas",
        description:
            "Consulta notas, cortes, acumulados y promedio, o registra una calificación.",
        commands: [
            "cuál es mi promedio del semestre",
            "qué materias voy ganando",
            "cuáles son mis notas de Comunicaciones Digitales",
            "qué nota tengo en el primer corte de Comunicaciones Digitales",
            "cuál es el acumulado de Comunicaciones Digitales",
            "registra 4.2 en el primer corte de Comunicaciones Digitales",
            "registra 4.5 en Quiz del primer corte de Comunicaciones Digitales",
        ],
        note:
            "En los ejemplos de notas puedes reemplazar Comunicaciones Digitales, el corte, la actividad y la calificación por los datos que necesites.",
    },
};

const heroSelectorByView: Record<AppView, string> = {
    home: ".home-header",
    "academic-life": ".header",
    "student-record": ".student-record-header",
    schedule: ".schedule-header",
    grades: ".grades-header",
};

function AppNavigation({ currentView }: AppNavigationProps) {
    const {
        accessMode,
        accountEmail,
        leaveCurrentAccess,
        showGuestInformation,
    } = useAppAccess();

    const [alexaPortalTarget, setAlexaPortalTarget] =
        useState<HTMLElement | null>(null);

    const isGuest = accessMode === "guest";
    const alexaSection = alexaCommandsByView[currentView];

    useEffect(() => {
        let animationFrame = 0;
        let portalElement: HTMLDivElement | null = null;

        const placeAlexaPanel = () => {
            const hero = document.querySelector<HTMLElement>(
                heroSelectorByView[currentView],
            );

            if (!hero) {
                animationFrame = window.requestAnimationFrame(placeAlexaPanel);
                return;
            }

            document
                .querySelectorAll(".alexa-commands-portal")
                .forEach((element) => element.remove());

            portalElement = document.createElement("div");
            portalElement.className = "alexa-commands-portal";
            portalElement.dataset.view = currentView;

            hero.insertAdjacentElement("afterend", portalElement);
            setAlexaPortalTarget(portalElement);
        };

        animationFrame = window.requestAnimationFrame(placeAlexaPanel);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            portalElement?.remove();
        };
    }, [currentView]);

    const handleNavigate = (destination: AppView): void => {
        if (destination === currentView) {
            return;
        }

        const url = new URL(window.location.href);

        if (destination === "home") {
            url.searchParams.delete("view");
        } else {
            url.searchParams.set("view", destination);
        }

        window.location.href = url.toString();
    };

    const alexaPanel = (
        <section
            className="alexa-commands-section"
            aria-label={`Comandos de Alexa para ${alexaSection.label}`}
        >
            <div className="alexa-commands-card">
                <div className="alexa-commands-card__intro">
                    <span className="alexa-commands-card__logo">
                        <img
                            src="/logo_alexa.png"
                            alt="Logo de Alexa"
                        />
                    </span>

                    <div className="alexa-commands-card__copy">
                        <p>Alexa + Mi pensum</p>
                        <h2>Usa {alexaSection.label} por voz</h2>
                        <span>
                            Para entrar a la skill di:
                            {" "}
                            <strong>
                                “Alexa, abre progreso académico”
                            </strong>
                        </span>
                    </div>
                </div>

                <details className="alexa-commands-card__details">
                    <summary>
                        Ver comandos de {alexaSection.label}
                    </summary>

                    <div className="alexa-commands-card__panel">
                        <p>
                            {alexaSection.description}
                            {" "}
                            Cuando Alexa responda, puedes decir cualquiera de estas frases:
                        </p>

                        <div className="alexa-commands-card__commands">
                            {alexaSection.commands.map((command) => (
                                <span
                                    className="alexa-commands-card__command"
                                    key={command}
                                >
                                    “{command}”
                                </span>
                            ))}
                        </div>

                        {alexaSection.note && (
                            <p className="alexa-commands-card__note">
                                {alexaSection.note}
                            </p>
                        )}

                        <p className="alexa-commands-card__note">
                            Para terminar también puedes decir:
                            {" "}
                            <strong>“salir de mi pensum”</strong>.
                        </p>
                    </div>
                </details>
            </div>
        </section>
    );

    return (
        <>
            <nav
                className="app-navigation"
                aria-label="Navegación principal"
            >
                <div className="app-navigation__content">
                    <div className="app-navigation__top">
                        <button
                            className="app-navigation__brand"
                            type="button"
                            onClick={() => handleNavigate("home")}
                            aria-label="Ir al inicio"
                        >
                            <span
                                className="app-navigation__brand-icon"
                                aria-hidden="true"
                            >
                                <LuGraduationCap />
                            </span>

                            <span className="app-navigation__brand-copy">
                                <strong>Mi pensum</strong>
                                <small>Universidad del Cauca</small>
                            </span>
                        </button>

                        <div className="app-navigation__account">
                            {isGuest ? (
                                <button
                                    className="app-navigation__identity app-navigation__identity--button"
                                    type="button"
                                    onClick={() => void showGuestInformation()}
                                    title="Ver condiciones del modo invitado"
                                >
                                    <span className="app-navigation__identity-icon">
                                        <LuUser aria-hidden="true" />
                                    </span>

                                    <span className="app-navigation__identity-copy">
                                        <strong>Modo invitado</strong>
                                        <small>Solo en este navegador</small>
                                    </span>
                                </button>
                            ) : (
                                <div className="app-navigation__identity">
                                    <span className="app-navigation__identity-icon">
                                        <LuUser aria-hidden="true" />
                                    </span>

                                    <span className="app-navigation__identity-copy">
                                        <strong>Cuenta iniciada</strong>
                                        <small title={accountEmail ?? undefined}>
                                            {accountEmail ?? "Usuario autenticado"}
                                        </small>
                                    </span>
                                </div>
                            )}

                            <button
                                className="app-navigation__logout"
                                type="button"
                                onClick={() => void leaveCurrentAccess()}
                            >
                                <LuLogOut aria-hidden="true" />
                                <span>
                                    {isGuest
                                        ? "Cambiar acceso"
                                        : "Cerrar sesión"}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="app-navigation__links">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentView === item.view;

                            return (
                                <button
                                    className={`app-navigation__link ${
                                        isActive
                                            ? "app-navigation__link--active"
                                            : ""
                                    }`}
                                    type="button"
                                    key={item.view}
                                    onClick={() => handleNavigate(item.view)}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    <Icon aria-hidden="true" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {alexaPortalTarget
                ? createPortal(alexaPanel, alexaPortalTarget)
                : null}
        </>
    );
}

export default AppNavigation;
