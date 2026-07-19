import {
    LuArrowLeft,
    LuCircleAlert,
    LuCircleCheck,
    LuGraduationCap,
    LuLockKeyhole,
    LuMoon,
    LuSun,
} from 'react-icons/lu'

import type {
    CurriculumSection,
    RepeatLevel,
    StudentAcademicSituation,
    StudentRegulatoryRecord,
    SubjectAcademicRecord,
    SubjectStatus,
} from '../types/curriculum'

interface RepeatCounts {
    r1: number
    r2: number
    r3: number
}

interface StudentAcademicRecordPageProps {
    curriculum: CurriculumSection[]
    subjectStatuses: Record<string, SubjectStatus>
    subjectAcademicRecords: Record<string, SubjectAcademicRecord>
    regulatoryRecord: StudentRegulatoryRecord
    situation: StudentAcademicSituation
    historicalRepeatCounts: RepeatCounts
    activeRepeatCounts: RepeatCounts
    completedSemesters: number
    themeMode: 'light' | 'dark'
    onToggleTheme: () => void
    onBack: () => void
}

const situationInformation: Record<
    StudentAcademicSituation,
    {
        label: string
        description: string
    }
> = {
    normal: {
        label: 'Situación académica normal',
        description:
            'No se registran restricciones reglamentarias activas.',
    },
    'low-performance': {
        label: 'Antecedente de bajo rendimiento',
        description:
            'Existe una pérdida registrada durante una primera repetición, R1.',
    },
    'conditional-enrollment': {
        label: 'Matrícula condicional activa',
        description:
            'La matrícula académica queda limitada a las materias que deban repetirse.',
    },
    'lost-right': {
        label: 'Pérdida del derecho a continuar',
        description:
            'El registro presenta una consecuencia académica definitiva que debe verificarse con la Universidad.',
    },
}

const getApprovedRepeatLevel = (
    record: SubjectAcademicRecord,
): RepeatLevel | null => {
    if (record.approvedRepeatLevel !== null) {
        return record.approvedRepeatLevel
    }

    for (let index = record.attempts.length - 1; index >= 0; index -= 1) {
        const attempt = record.attempts[index]

        if (attempt.result === 'approved') {
            return attempt.repeatLevel
        }
    }

    return null
}

const getRepeatLabel = (
    repeatLevel: RepeatLevel | null,
) => {
    if (repeatLevel === null || repeatLevel === 0) {
        return '—'
    }

    return `R${repeatLevel}`
}

const getAttemptLabel = (
    repeatLevel: RepeatLevel,
) => {
    if (repeatLevel === 0) {
        return 'Intento regular'
    }

    return `R${repeatLevel}`
}

const getStatusLabel = (status: SubjectStatus) => {
    if (status === 'approved') {
        return 'Aprobada'
    }

    if (status === 'in-progress') {
        return 'En curso'
    }

    return 'Pendiente'
}

function StudentAcademicRecordPage({
    curriculum,
    subjectStatuses,
    subjectAcademicRecords,
    regulatoryRecord,
    situation,
    historicalRepeatCounts,
    activeRepeatCounts,
    completedSemesters,
    themeMode,
    onToggleTheme,
    onBack,
}: StudentAcademicRecordPageProps) {
    const situationData = situationInformation[situation]

    const restrictions: string[] = []

    if (regulatoryRecord.lostRightToContinue) {
        restrictions.push(
            'El sistema bloquea nuevos avances académicos hasta verificar la situación con la Universidad.',
        )
    } else if (regulatoryRecord.conditionalEnrollmentActive) {
        restrictions.push(
            'Solo se pueden registrar como En curso o Aprobadas las asignaturas que deban repetirse.',
        )
    }

    if (regulatoryRecord.hasLowPerformanceHistory) {
        restrictions.push(
            'Existe un antecedente de bajo rendimiento académico en el historial.',
        )
    }

    if (activeRepeatCounts.r3 > 0) {
        restrictions.push(
            `Hay ${activeRepeatCounts.r3} ${activeRepeatCounts.r3 === 1 ? 'materia activa' : 'materias activas'
            } en R3.`,
        )
    }

    if (regulatoryRecord.hasDisciplinarySanction) {
        restrictions.push(
            'Se encuentra registrada una sanción disciplinaria para futuras evaluaciones de pérdidas en R2.',
        )
    }

    if (restrictions.length === 0) {
        restrictions.push('No hay restricciones académicas activas registradas.')
    }

    const rows = curriculum.flatMap((section) =>
        section.subjects.map((subject) => {
            const status = subjectStatuses[subject.code] ?? 'pending'
            const record = subjectAcademicRecords[subject.code] ?? {
                repeatLevel: 0 as RepeatLevel,
                approvedRepeatLevel: null,
                failedAttempts: 0,
                attempts: [],
            }
            const approved = status === 'approved'
            const approvedRepeatLevel = getApprovedRepeatLevel(record)
            const displayedRepeatLevel = approved
                ? approvedRepeatLevel
                : record.repeatLevel > 0
                    ? record.repeatLevel
                    : approvedRepeatLevel

            let restriction = 'Sin restricción individual'

            if (regulatoryRecord.lostRightToContinue && !approved) {
                restriction = 'Cambios académicos bloqueados'
            } else if (
                regulatoryRecord.conditionalEnrollmentActive &&
                record.repeatLevel === 0 &&
                !approved
            ) {
                restriction = 'No habilitada durante matrícula condicional'
            } else if (approved && displayedRepeatLevel && displayedRepeatLevel > 0) {
                restriction = `Aprobada en R${displayedRepeatLevel}`
            } else if (status === 'in-progress' && record.repeatLevel > 0) {
                restriction = `Cursando R${record.repeatLevel}`
            } else if (status === 'pending' && record.repeatLevel > 0) {
                restriction = `Debe cursar R${record.repeatLevel}`
            } else if (
                regulatoryRecord.hasLowPerformanceHistory &&
                record.repeatLevel >= 2 &&
                !approved
            ) {
                restriction = 'Bajo rendimiento registrado'
            }

            return {
                section,
                subject,
                status,
                record,
                approved,
                displayedRepeatLevel,
                restriction,
            }
        }),
    )

    return (
        <div className="student-record-page">
            <header className="student-record-header">
                <div className="student-record-header__content">
                    <div className="student-record-header__intro">
                        <p className="student-record-header__eyebrow">
                            Ingeniería Electrónica y Telecomunicaciones
                        </p>

                        <div className="student-record-header__title-row">
                            <LuGraduationCap aria-hidden="true" />
                            <h1>Hoja de vida académica</h1>
                        </div>

                        <p>
                            Consulta el estado de cada materia, las repitencias
                            registradas y las restricciones académicas vigentes.
                        </p>
                    </div>

                    <div className="student-record-header__actions">
                        <button
                            type="button"
                            onClick={onToggleTheme}
                            aria-label={
                                themeMode === 'dark'
                                    ? 'Activar modo claro'
                                    : 'Activar modo oscuro'
                            }
                        >
                            {themeMode === 'dark' ? (
                                <LuSun aria-hidden="true" />
                            ) : (
                                <LuMoon aria-hidden="true" />
                            )}

                            {themeMode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                        </button>

                        <button type="button" onClick={onBack}>
                            <LuArrowLeft aria-hidden="true" />
                            Volver al pensum
                        </button>
                    </div>
                </div>
            </header>

            <main className="student-record-main">
                <section
                    className="student-record-overview"
                    aria-label="Situación y restricciones académicas"
                >
                    <article className={`student-record-panel student-record-panel--${situation}`}>
                        <div className="student-record-panel__heading">
                            <span aria-hidden="true">
                                {situation === 'normal' ? (
                                    <LuCircleCheck />
                                ) : situation === 'low-performance' ? (
                                    <LuCircleAlert />
                                ) : (
                                    <LuLockKeyhole />
                                )}
                            </span>

                            <div>
                                <p>Situación actual</p>
                                <h2>{situationData.label}</h2>
                            </div>
                        </div>

                        <p className="student-record-panel__description">
                            {situationData.description}
                        </p>

                        <dl className="student-record-facts">
                            <div>
                                <dt>Semestres completados</dt>
                                <dd>{completedSemesters} / 10</dd>
                            </div>

                            <div>
                                <dt>Bajo rendimiento registrado</dt>
                                <dd>
                                    {regulatoryRecord.hasLowPerformanceHistory ? 'Sí' : 'No'}
                                </dd>
                            </div>

                            <div>
                                <dt>Matrícula condicional</dt>
                                <dd>
                                    {regulatoryRecord.conditionalEnrollmentActive
                                        ? 'Activa'
                                        : 'Inactiva'}
                                </dd>
                            </div>

                            <div>
                                <dt>Ocasiones utilizadas</dt>
                                <dd>
                                    {regulatoryRecord.conditionalEnrollmentsUsed} / 2
                                </dd>
                            </div>

                            <div>
                                <dt>Sanción disciplinaria</dt>
                                <dd>
                                    {regulatoryRecord.hasDisciplinarySanction ? 'Sí' : 'No'}
                                </dd>
                            </div>

                            <div>
                                <dt>Derecho a continuar</dt>
                                <dd>
                                    {regulatoryRecord.lostRightToContinue
                                        ? 'Requiere verificación'
                                        : 'Vigente'}
                                </dd>
                            </div>
                        </dl>
                    </article>

                    <article className="student-record-panel student-record-panel--restrictions">
                        <div className="student-record-panel__heading">
                            <span aria-hidden="true">
                                <LuLockKeyhole />
                            </span>

                            <div>
                                <p>Seguimiento reglamentario</p>
                                <h2>Restricciones y antecedentes</h2>
                            </div>
                        </div>

                        <ul className="student-record-restrictions">
                            {restrictions.map((restriction) => (
                                <li key={restriction}>{restriction}</li>
                            ))}
                        </ul>

                        <div className="student-record-repeat-summary">
                            <div>
                                <span>R1</span>
                                <strong>{historicalRepeatCounts.r1}</strong>
                                <small>{activeRepeatCounts.r1} activas</small>
                            </div>

                            <div>
                                <span>R2</span>
                                <strong>{historicalRepeatCounts.r2}</strong>
                                <small>{activeRepeatCounts.r2} activas</small>
                            </div>

                            <div>
                                <span>R3</span>
                                <strong>{historicalRepeatCounts.r3}</strong>
                                <small>{activeRepeatCounts.r3} activas</small>
                            </div>
                        </div>
                    </article>
                </section>

                <section
                    className="student-record-table-panel"
                    aria-labelledby="student-record-table-title"
                >
                    <header className="student-record-table-panel__header">
                        <div>
                            <p>Registro por asignatura</p>
                            <h2 id="student-record-table-title">
                                Historial del plan de estudios
                            </h2>
                        </div>

                        <span>{rows.length} materias registradas</span>
                    </header>

                    <div className="student-record-table-wrapper">
                        <table className="student-record-table">
                            <thead>
                                <tr>
                                    <th scope="col">Semestre</th>
                                    <th scope="col">Materia</th>
                                    <th scope="col">Aprobada</th>
                                    <th scope="col">Repitencia</th>
                                    <th scope="col">Estado / situación</th>
                                    <th scope="col">Historial</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.subject.code}>
                                        <td>
                                            {row.section.semester !== undefined
                                                ? `Semestre ${row.section.semester}`
                                                : 'Adicional'}
                                        </td>

                                        <td>
                                            <strong>{row.subject.name}</strong>
                                            <small>{row.subject.code}</small>
                                        </td>

                                        <td>
                                            <span
                                                className={`student-record-pill ${row.approved
                                                    ? 'student-record-pill--yes'
                                                    : 'student-record-pill--no'
                                                    }`}
                                            >
                                                {row.approved ? 'Sí' : 'No'}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={`student-record-repeat student-record-repeat--${row.displayedRepeatLevel && row.displayedRepeatLevel > 0
                                                    ? `r${row.displayedRepeatLevel}`
                                                    : 'regular'
                                                    }`}
                                            >
                                                {getRepeatLabel(row.displayedRepeatLevel)}
                                            </span>
                                        </td>

                                        <td>
                                            <strong className="student-record-current-status">
                                                {getStatusLabel(row.status)}
                                                {row.approved &&
                                                    row.displayedRepeatLevel &&
                                                    row.displayedRepeatLevel > 0
                                                    ? ` R${row.displayedRepeatLevel}`
                                                    : ''}
                                            </strong>

                                            <small className="student-record-restriction-text">
                                                {row.restriction}
                                            </small>
                                        </td>

                                        <td>
                                            {row.record.attempts.length > 0 ? (
                                                <details className="student-record-attempts">
                                                    <summary>
                                                        {row.record.attempts.length}{' '}
                                                        {row.record.attempts.length === 1
                                                            ? 'registro'
                                                            : 'registros'}
                                                    </summary>

                                                    <ol>
                                                        {row.record.attempts.map((attempt) => (
                                                            <li key={attempt.id}>
                                                                <strong>
                                                                    {getAttemptLabel(attempt.repeatLevel)}
                                                                </strong>
                                                                <span>
                                                                    {attempt.result === 'approved'
                                                                        ? 'Aprobada'
                                                                        : 'Perdida'}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </details>
                                            ) : (
                                                <span className="student-record-no-history">
                                                    Sin registros
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <p className="student-record-disclaimer">
                    Esta hoja de vida es una herramienta personal de seguimiento y
                    no reemplaza el registro académico oficial de la Universidad del
                    Cauca.
                </p>
            </main>
        </div>
    )
}

export default StudentAcademicRecordPage