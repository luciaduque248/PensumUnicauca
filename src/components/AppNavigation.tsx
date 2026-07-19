import {
    LuBookOpen,
    LuCalendarDays,
    LuGraduationCap,
    LuHouse,
} from "react-icons/lu";

export type AppView =
    | "home"
    | "academic-life"
    | "student-record"
    | "schedule";

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
    ];

function AppNavigation({
    currentView,
}: AppNavigationProps) {
    const handleNavigate = (
        destination: AppView,
    ) => {
        if (destination === currentView) {
            return;
        }

        const url = new URL(
            window.location.href,
        );

        if (destination === "home") {
            url.searchParams.delete("view");
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
                <button
                    className="app-navigation__brand"
                    type="button"
                    onClick={() =>
                        handleNavigate("home")
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
                        <strong>Mi pensum</strong>
                        <small>Universidad del Cauca</small>
                    </span>
                </button>

                <div className="app-navigation__links">
                    {navigationItems.map(
                        (item) => {
                            const Icon = item.icon;

                            const isActive =
                                currentView === item.view;

                            return (
                                <button
                                    className={`app-navigation__link ${isActive
                                            ? "app-navigation__link--active"
                                            : ""
                                        }`}
                                    type="button"
                                    key={item.view}
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
                                    <Icon aria-hidden="true" />

                                    <span>
                                        {item.label}
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