import {
    LuBookOpen,
    LuBookOpenCheck,
    LuClock3,
    LuLayers3,
    LuLockKeyhole,
    LuTrophy,
} from "react-icons/lu";

interface StrongestSemester {
    title: string;
    percentage: number;
    approvedCredits: number;
    totalCredits: number;
}

interface AcademicStatisticsProps {
    approvedSubjects: number;
    totalSubjects: number;
    inProgressSubjects: number;
    blockedSubjects: number;
    remainingCredits: number;
    totalCredits: number;
    completedSemesters: number;
    totalSemesters: number;
    strongestSemester: StrongestSemester | null;
}

function AcademicStatistics({
    approvedSubjects,
    totalSubjects,
    inProgressSubjects,
    blockedSubjects,
    remainingCredits,
    totalCredits,
    completedSemesters,
    totalSemesters,
    strongestSemester,
}: AcademicStatisticsProps) {
    return (
        <section
            className="academic-statistics"
            aria-labelledby="academic-statistics-title"
        >
            <header className="academic-statistics__header">
                <div>
                    <p className="section-heading__eyebrow">
                        Análisis del progreso
                    </p>

                    <h2 id="academic-statistics-title">
                        Estadísticas académicas
                    </h2>

                    <p>
                        Resumen general calculado a partir del estado actual
                        de tus materias.
                    </p>
                </div>
            </header>

            <div className="academic-statistics__grid">
                <article className="academic-statistic academic-statistic--approved">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuBookOpenCheck />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Materias aprobadas
                        </span>

                        <strong className="academic-statistic__value">
                            {approvedSubjects}
                        </strong>

                        <span className="academic-statistic__detail">
                            De {totalSubjects} materias
                        </span>
                    </div>
                </article>

                <article className="academic-statistic academic-statistic--progress">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuClock3 />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Materias en curso
                        </span>

                        <strong className="academic-statistic__value">
                            {inProgressSubjects}
                        </strong>

                        <span className="academic-statistic__detail">
                            Todavía no suman créditos aprobados
                        </span>
                    </div>
                </article>

                <article className="academic-statistic academic-statistic--blocked">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuLockKeyhole />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Materias bloqueadas
                        </span>

                        <strong className="academic-statistic__value">
                            {blockedSubjects}
                        </strong>

                        <span className="academic-statistic__detail">
                            Requieren prerrequisitos pendientes
                        </span>
                    </div>
                </article>

                <article className="academic-statistic academic-statistic--credits">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuBookOpen />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Créditos restantes
                        </span>

                        <strong className="academic-statistic__value">
                            {remainingCredits}
                        </strong>

                        <span className="academic-statistic__detail">
                            De {totalCredits} créditos del programa
                        </span>
                    </div>
                </article>

                <article className="academic-statistic academic-statistic--semesters">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuLayers3 />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Semestres completados
                        </span>

                        <strong className="academic-statistic__value">
                            {completedSemesters} / {totalSemesters}
                        </strong>

                        <span className="academic-statistic__detail">
                            Con todas sus materias aprobadas
                        </span>
                    </div>
                </article>

                <article className="academic-statistic academic-statistic--strongest">
                    <div
                        className="academic-statistic__icon"
                        aria-hidden="true"
                    >
                        <LuTrophy />
                    </div>

                    <div className="academic-statistic__information">
                        <span className="academic-statistic__label">
                            Semestre con mayor avance
                        </span>

                        <strong className="academic-statistic__value academic-statistic__value--text">
                            {strongestSemester?.title ?? "Sin avance"}
                        </strong>

                        <span className="academic-statistic__detail">
                            {strongestSemester
                                ? `${strongestSemester.percentage} % · ${strongestSemester.approvedCredits} / ${strongestSemester.totalCredits} créditos`
                                : "Aún no hay materias aprobadas"}
                        </span>
                    </div>
                </article>
            </div>
        </section>
    );
}

export default AcademicStatistics;