import {
    LuCalendarDays,
    LuClock3,
    LuMoon,
    LuSun,
} from "react-icons/lu";

interface SchedulePageProps {
    themeMode: "light" | "dark";
    onToggleTheme: () => void;
}

function SchedulePage({
    themeMode,
    onToggleTheme,
}: SchedulePageProps) {
    return (
        <div className="schedule-page">
            <header className="schedule-header">
                <div className="schedule-header__content">
                    <div className="schedule-header__intro">
                        <p className="schedule-header__eyebrow">
                            Organización del semestre
                        </p>

                        <div className="schedule-header__title">
                            <LuCalendarDays
                                aria-hidden="true"
                            />

                            <h1>Horario académico</h1>
                        </div>

                        <p className="schedule-header__description">
                            Organiza las materias que estás
                            cursando y consulta su distribución
                            semanal.
                        </p>
                    </div>

                    <button
                        className="schedule-header__theme-button"
                        type="button"
                        onClick={onToggleTheme}
                        aria-label={
                            themeMode === "dark"
                                ? "Activar modo claro"
                                : "Activar modo oscuro"
                        }
                    >
                        {themeMode === "dark" ? (
                            <LuSun aria-hidden="true" />
                        ) : (
                            <LuMoon aria-hidden="true" />
                        )}

                        {themeMode === "dark"
                            ? "Modo claro"
                            : "Modo oscuro"}
                    </button>
                </div>
            </header>

            <main className="schedule-main">
                <section className="schedule-empty">
                    <span
                        className="schedule-empty__icon"
                        aria-hidden="true"
                    >
                        <LuClock3 />
                    </span>

                    <p className="schedule-empty__eyebrow">
                        Horario sin configurar
                    </p>

                    <h2>
                        Todavía no hay clases registradas
                    </h2>

                    <p>
                        En la siguiente etapa podrás
                        seleccionar materias, asignar días,
                        indicar horas y conservar el horario
                        en el almacenamiento local del
                        navegador.
                    </p>
                </section>
            </main>
        </div>
    );
}

export default SchedulePage;