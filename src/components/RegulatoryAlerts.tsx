import {
    LuCircleAlert,
    LuCircleCheck,
    LuLockKeyhole,
} from 'react-icons/lu'

import type {
    StudentAcademicSituation,
    StudentRegulatoryRecord,
} from '../types/curriculum'

interface RepeatCounts {
    r1: number
    r2: number
    r3: number
}

interface RegulatoryAlertsProps {
    situation: StudentAcademicSituation
    regulatoryRecord: StudentRegulatoryRecord
    historicalRepeatCounts: RepeatCounts
    activeRepeatCounts: RepeatCounts
    onDisciplinarySanctionChange: (
        hasSanction: boolean,
    ) => void | Promise<void>
}

const situationInformation: Record<
    StudentAcademicSituation,
    {
        title: string
        description: string
    }
> = {
    normal: {
        title: 'Situación académica normal',
        description:
            'No hay restricciones reglamentarias activas registradas en el sistema.',
    },
    'low-performance': {
        title: 'Antecedente de bajo rendimiento',
        description:
            'Se registró la pérdida de una materia cursada como repitente por primera vez.',
    },
    'conditional-enrollment': {
        title: 'Matrícula condicional activa',
        description:
            'Solo se pueden registrar como en curso asignaturas que deban repetirse.',
    },
    'lost-right': {
        title: 'Pérdida del derecho a continuar',
        description:
            'El historial registrado presenta una consecuencia académica definitiva que debe verificarse con la Universidad.',
    },
}

function RegulatoryAlerts({
    situation,
    regulatoryRecord,
    historicalRepeatCounts,
    activeRepeatCounts,
    onDisciplinarySanctionChange,
}: RegulatoryAlertsProps) {
    const baseInformation = situationInformation[situation]

    const hasRepeatHistory =
        historicalRepeatCounts.r1 > 0 ||
        historicalRepeatCounts.r2 > 0 ||
        historicalRepeatCounts.r3 > 0

    const information =
        situation === 'normal' && hasRepeatHistory
            ? {
                title: 'Situación académica normal con historial',
                description:
                    'No hay restricciones activas, pero el historial de materias cursadas en repetición se conserva.',
            }
            : baseInformation

    const repeatCards = [
        {
            level: 'R1',
            history: historicalRepeatCounts.r1,
            active: activeRepeatCounts.r1,
            className: 'r1',
            label: 'Primera repetición',
        },
        {
            level: 'R2',
            history: historicalRepeatCounts.r2,
            active: activeRepeatCounts.r2,
            className: 'r2',
            label: 'Segunda repetición',
        },
        {
            level: 'R3',
            history: historicalRepeatCounts.r3,
            active: activeRepeatCounts.r3,
            className: 'r3',
            label: 'Tercera repetición',
        },
    ]

    return (
        <section
            className={`regulatory-alerts regulatory-alerts--${situation}`}
            aria-labelledby="regulatory-alerts-title"
        >
            <header className="regulatory-alerts__header">
                <div className="regulatory-alerts__heading">
                    <span
                        className="regulatory-alerts__heading-icon"
                        aria-hidden="true"
                    >
                        {situation === 'normal' ? (
                            <LuCircleCheck />
                        ) : situation === 'conditional-enrollment' ||
                            situation === 'lost-right' ? (
                            <LuLockKeyhole />
                        ) : (
                            <LuCircleAlert />
                        )}
                    </span>

                    <div>
                        <p className="section-heading__eyebrow">
                            Seguimiento reglamentario
                        </p>

                        <h2 id="regulatory-alerts-title">
                            {information.title}
                        </h2>

                        <p>{information.description}</p>
                    </div>
                </div>

                <span className="regulatory-alerts__conditional-count">
                    Matrículas condicionales:{' '}
                    <strong>
                        {regulatoryRecord.conditionalEnrollmentsUsed} / 2
                    </strong>
                </span>
            </header>

            <div className="regulatory-alerts__grid">
                {repeatCards.map((card) => (
                    <article
                        className={`regulatory-alerts__stat regulatory-alerts__stat--${card.className}`}
                        key={card.level}
                    >
                        <span>{card.level}</span>

                        <strong>{card.history}</strong>

                        <small>
                            {card.label} · {card.active}{' '}
                            {card.active === 1 ? 'activa' : 'activas'}
                        </small>
                    </article>
                ))}
            </div>

            <p className="regulatory-alerts__history-note">
                Los valores principales corresponden al historial acumulado.
                Aprobar una materia en R1, R2 o R3 no elimina ese antecedente.
            </p>

            {regulatoryRecord.conditionalEnrollmentActive && (
                <div className="regulatory-alerts__restriction">
                    <LuLockKeyhole aria-hidden="true" />

                    <div>
                        <strong>Restricción de matrícula condicional</strong>
                        <p>
                            Las materias regulares que nunca han sido perdidas no
                            pueden cambiarse a “En curso” o “Aprobada” mientras esta
                            condición permanezca activa.
                        </p>
                    </div>
                </div>
            )}

            {activeRepeatCounts.r3 > 0 &&
                !regulatoryRecord.lostRightToContinue && (
                    <div className="regulatory-alerts__critical-note">
                        <LuCircleAlert aria-hidden="true" />

                        <p>
                            Tienes {activeRepeatCounts.r3}{' '}
                            {activeRepeatCounts.r3 === 1 ? 'materia' : 'materias'}
                            {' '}activas en R3. Registrar una nueva pérdida en ese
                            nivel produce una alerta académica crítica.
                        </p>
                    </div>
                )}

            <label className="disciplinary-sanction-toggle">
                <input
                    type="checkbox"
                    checked={regulatoryRecord.hasDisciplinarySanction}
                    onChange={(event) =>
                        onDisciplinarySanctionChange(event.target.checked)
                    }
                />

                <span className="disciplinary-sanction-toggle__box" />

                <span className="disciplinary-sanction-toggle__copy">
                    <strong>Sanción disciplinaria registrada</strong>
                    <small>
                        Este dato se utiliza al evaluar una pérdida en R2. No se
                        aplica retroactivamente a pérdidas ya registradas.
                    </small>
                </span>
            </label>

            <p className="regulatory-alerts__disclaimer">
                Este panel es una herramienta orientativa de seguimiento. La
                situación oficial debe confirmarse con la Facultad y con la
                División de Admisiones, Registro y Control Académico.
            </p>
        </section>
    )
}

export default RegulatoryAlerts