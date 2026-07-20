import {
    LuBookOpen,
    LuCalculator,
    LuCalendarDays,
    LuGraduationCap,
    LuHouse,
    LuLogOut,
    LuUser,
} from "react-icons/lu";

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
            view:
                "academic-life",
            label:
                "Vida académica",
            icon: LuBookOpen,
        },
        {
            view:
                "student-record",
            label:
                "Hoja de vida académica",
            icon:
                LuGraduationCap,
        },
        {
            view: "schedule",
            label: "Horario",
            icon:
                LuCalendarDays,
        },
        {
            view: "grades",
            label: "Notas",
            icon:
                LuCalculator,
        },
    ];

function AppNavigation({
    currentView,
}: AppNavigationProps) {
    const {
        accessMode,
        accountEmail,
        leaveCurrentAccess,
        showGuestInformation,
    } = useAppAccess();

    const isGuest =
        accessMode ===
        "guest";

    const handleNavigate = (
        destination: AppView,
    ): void => {
        if (
            destination ===
            currentView
        ) {
            return;
        }

        const url =
            new URL(
                window.location.href,
            );

        if (
            destination ===
            "home"
        ) {
            url.searchParams.delete(
                "view",
            );
        } else {
            url.searchParams.set(
                "view",
                destination,
            );
        }

        window.location.href =
            url.toString();
    };

    return (
        <nav
            className="app-navigation"
            aria-label="Navegación principal"
        >
            <div className="app-navigation__content">
                <div className="app-navigation__top">
                    <button
                        className="app-navigation__brand"
                        type="button"
                        onClick={() =>
                            handleNavigate(
                                "home",
                            )
                        }
                        aria-label="Ir al inicio"
                    >
                        <span
                            className="app-navigation__brand-icon"
                            aria-hidden="true"
                        >
                            <LuGraduationCap />
                        </span>

                        <span className="app-navigation__brand-copy">
                            <strong>
                                Mi pensum
                            </strong>

                            <small>
                                Universidad del Cauca
                            </small>
                        </span>
                    </button>

                    <div className="app-navigation__account">
                        {isGuest ? (
                            <button
                                className="app-navigation__identity app-navigation__identity--button"
                                type="button"
                                onClick={() =>
                                    void showGuestInformation()
                                }
                                title="Ver condiciones del modo invitado"
                            >
                                <span className="app-navigation__identity-icon">
                                    <LuUser
                                        aria-hidden="true"
                                    />
                                </span>

                                <span className="app-navigation__identity-copy">
                                    <strong>
                                        Modo invitado
                                    </strong>

                                    <small>
                                        Solo en este navegador
                                    </small>
                                </span>
                            </button>
                        ) : (
                            <div className="app-navigation__identity">
                                <span className="app-navigation__identity-icon">
                                    <LuUser
                                        aria-hidden="true"
                                    />
                                </span>

                                <span className="app-navigation__identity-copy">
                                    <strong>
                                        Cuenta iniciada
                                    </strong>

                                    <small
                                        title={
                                            accountEmail ??
                                            undefined
                                        }
                                    >
                                        {accountEmail ??
                                            "Usuario autenticado"}
                                    </small>
                                </span>
                            </div>
                        )}

                        <button
                            className="app-navigation__logout"
                            type="button"
                            onClick={() =>
                                void leaveCurrentAccess()
                            }
                        >
                            <LuLogOut
                                aria-hidden="true"
                            />

                            <span>
                                {isGuest
                                    ? "Cambiar acceso"
                                    : "Cerrar sesión"}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="app-navigation__links">
                    {navigationItems.map(
                        (
                            item,
                        ) => {
                            const Icon =
                                item.icon;

                            const isActive =
                                currentView ===
                                item.view;

                            return (
                                <button
                                    className={`app-navigation__link ${isActive
                                            ? "app-navigation__link--active"
                                            : ""
                                        }`}
                                    type="button"
                                    key={
                                        item.view
                                    }
                                    onClick={() =>
                                        handleNavigate(
                                            item.view,
                                        )
                                    }
                                    aria-current={
                                        isActive
                                            ? "page"
                                            : undefined
                                    }
                                >
                                    <Icon
                                        aria-hidden="true"
                                    />

                                    <span>
                                        {
                                            item.label
                                        }
                                    </span>
                                </button>
                            );
                        },
                    )}
                </div>
            </div>
        </nav>
    );
}

export default AppNavigation;