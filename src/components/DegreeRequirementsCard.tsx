import type {
    DegreeRequirement,
    DegreeRequirementStatus,
} from '../types/curriculum'

interface DegreeRequirementsCardProps {
    requirements: DegreeRequirement[]
    requirementStatuses: Record<
        string,
        DegreeRequirementStatus
    >
    onStatusChange: (
        requirement: DegreeRequirement,
        newStatus: DegreeRequirementStatus,
    ) => void | Promise<void>
}

function DegreeRequirementsCard({
    requirements,
    requirementStatuses,
    onStatusChange,
}: DegreeRequirementsCardProps) {
    const completedRequirements = requirements.filter(
        (requirement) =>
            requirementStatuses[requirement.code] ===
            'completed',
    ).length

    const progressPercentage =
        requirements.length === 0
            ? 0
            : Math.round(
                (completedRequirements /
                    requirements.length) *
                100,
            )

    return (
        <section
            className="degree-requirements"
            aria-labelledby="degree-requirements-title"
        >
            <header className="degree-requirements__header">
                <div>
                    <p className="section-heading__eyebrow">
                        Cierre académico
                    </p>

                    <h2 id="degree-requirements-title">
                        Requisitos de grado
                    </h2>

                    <p className="degree-requirements__description">
                        Estos requisitos son obligatorios, pero no suman
                        créditos al progreso académico.
                    </p>
                </div>

                <div className="degree-requirements__summary">
                    <strong>
                        {completedRequirements} / {requirements.length}
                    </strong>

                    <span>completados</span>
                </div>
            </header>

            <div
                className="degree-requirements__progress"
                aria-label={`Requisitos de grado completados: ${progressPercentage} por ciento`}
            >
                <div
                    className="degree-requirements__progress-value"
                    style={{
                        width: `${progressPercentage}%`,
                    }}
                />
            </div>

            <div className="degree-requirements__grid">
                {requirements.map((requirement) => {
                    const currentStatus =
                        requirementStatuses[requirement.code] ??
                        'pending'

                    const isCompleted =
                        currentStatus === 'completed'

                    return (
                        <article
                            className={`degree-requirement degree-requirement--${currentStatus}`}
                            key={requirement.code}
                        >
                            <div className="degree-requirement__heading">
                                <span className="degree-requirement__code">
                                    {requirement.code}
                                </span>

                                <span
                                    className={`degree-requirement__status degree-requirement__status--${currentStatus}`}
                                >
                                    {isCompleted
                                        ? 'Completado'
                                        : 'Pendiente'}
                                </span>
                            </div>

                            <h3>{requirement.name}</h3>

                            <p>{requirement.description}</p>

                            <div
                                className="degree-requirement__actions"
                                role="group"
                                aria-label={`Estado de ${requirement.name}`}
                            >
                                <button
                                    type="button"
                                    className={`degree-requirement__button ${!isCompleted
                                            ? 'degree-requirement__button--active-pending'
                                            : ''
                                        }`}
                                    disabled={!isCompleted}
                                    onClick={() =>
                                        void onStatusChange(
                                            requirement,
                                            'pending',
                                        )
                                    }
                                >
                                    Pendiente
                                </button>

                                <button
                                    type="button"
                                    className={`degree-requirement__button ${isCompleted
                                            ? 'degree-requirement__button--active-completed'
                                            : ''
                                        }`}
                                    disabled={isCompleted}
                                    onClick={() =>
                                        void onStatusChange(
                                            requirement,
                                            'completed',
                                        )
                                    }
                                >
                                    Completado
                                </button>
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}

export default DegreeRequirementsCard