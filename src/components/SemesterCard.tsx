import type {
  CurriculumSection,
  Subject,
  SubjectAcademicRecord,
  SubjectStatus,
} from '../types/curriculum'

import {
  LuArrowDown,
  LuCheckCheck,
  LuCircleAlert,
  LuCircleCheck,
  LuLockKeyhole,
  LuMinus,
  LuPlus,
} from "react-icons/lu";

interface SemesterCardProps {
  section: CurriculumSection
  visibleSubjects: Subject[]
  prerequisiteNamesByCode: Record<string, string>
  unlockedSubjectsByCode: Record<string, Subject[]>
  subjectStatuses: Record<string, SubjectStatus>
  subjectAcademicRecords: Record<
    string,
    SubjectAcademicRecord
  >
  conditionalEnrollmentActive: boolean
  lostRightToContinue: boolean
  onStatusChange: (
    subjectCode: string,
    newStatus: SubjectStatus,
  ) => void | Promise<void>
  onRegisterFailure: (
    subject: Subject,
  ) => void | Promise<void>
  onApproveAll: () => void | Promise<void>
}

function SemesterCard({
  section,
  visibleSubjects,
  prerequisiteNamesByCode,
  unlockedSubjectsByCode,
  subjectStatuses,
  subjectAcademicRecords,
  conditionalEnrollmentActive,
  lostRightToContinue,
  onStatusChange,
  onRegisterFailure,
  onApproveAll,
}: SemesterCardProps) {
  const semesterCredits = section.subjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  )

  const approvedSubjectsCount = section.subjects.filter(
    (subject) =>
      subjectStatuses[subject.code] === 'approved',
  ).length

  const approvedSemesterCredits = section.subjects.reduce(
    (total, subject) => {
      const isApproved =
        subjectStatuses[subject.code] === 'approved'

      return isApproved
        ? total + subject.credits
        : total
    },
    0,
  )

  const semesterProgressPercentage =
    semesterCredits === 0
      ? 0
      : Math.round(
        (approvedSemesterCredits /
          semesterCredits) *
        100,
      )

  const isSemesterCompleted =
    section.subjects.length > 0 &&
    approvedSubjectsCount === section.subjects.length

  const isAdditionalSection =
    section.semester === undefined

  const allSubjectsApproved = section.subjects.every(
    (subject) =>
      subjectStatuses[subject.code] === 'approved',
  )

  /*
   * Un prerrequisito bloquea la materia únicamente cuando:
   *
   * 1. Pertenece al pensum.
   * 2. Su estado todavía no es "approved".
   *
   * Los requisitos externos no existen dentro de
   * subjectStatuses, por lo que no bloquean la materia.
   */
  const hasLockedSubjects = section.subjects.some(
    (subject) => {
      const currentStatus =
        subjectStatuses[subject.code] ?? 'pending'

      if (currentStatus === 'approved') {
        return false
      }

      return subject.prerequisites.some(
        (prerequisiteCode) => {
          const prerequisiteStatus =
            subjectStatuses[prerequisiteCode]

          return (
            prerequisiteStatus !== undefined &&
            prerequisiteStatus !== 'approved'
          )
        },
      )
    },
  )

  const getPrerequisiteName = (code: string) => {
    return (
      prerequisiteNamesByCode[code] ??
      'Materia no registrada'
    )
  }

  const getApprovedRepeatLevel = (
    record: SubjectAcademicRecord,
  ) => {
    if (record.approvedRepeatLevel !== null) {
      return record.approvedRepeatLevel
    }

    for (
      let index = record.attempts.length - 1;
      index >= 0;
      index -= 1
    ) {
      const attempt = record.attempts[index]

      if (attempt.result === 'approved') {
        return attempt.repeatLevel
      }
    }

    return null
  }

  const getRepeatLabel = (
    repeatLevel: SubjectAcademicRecord["repeatLevel"] | null,
  ) => {
    if (repeatLevel === null || repeatLevel === 0) {
      return null
    }

    return `R${repeatLevel}`
  }

  const getStatusLabel = (
    status: SubjectStatus,
    approvedRepeatLevel: SubjectAcademicRecord["repeatLevel"] | null = null,
  ) => {
    if (status === 'approved') {
      return approvedRepeatLevel && approvedRepeatLevel > 0
        ? `Aprobada R${approvedRepeatLevel}`
        : 'Aprobada'
    }

    if (status === 'in-progress') {
      return 'En curso'
    }

    return 'Pendiente'
  }

  const getPrerequisiteStatusLabel = (
    prerequisiteCode: string,
  ) => {
    const status = subjectStatuses[prerequisiteCode]

    if (status === undefined) {
      return 'Externo'
    }

    return getStatusLabel(status)
  }

  const getPrerequisiteStatusClass = (
    prerequisiteCode: string,
  ) => {
    const status = subjectStatuses[prerequisiteCode]

    if (status === undefined) {
      return 'external'
    }

    return status
  }

  const getUnlockedSubjectState = (
    unlockedSubject: Subject,
  ) => {
    const currentStatus =
      subjectStatuses[unlockedSubject.code] ??
      'pending'

    if (currentStatus === 'approved') {
      return {
        label: 'Aprobada',
        className: 'approved',
      }
    }

    const missingPrerequisites =
      unlockedSubject.prerequisites.filter(
        (prerequisiteCode) => {
          const prerequisiteStatus =
            subjectStatuses[prerequisiteCode]

          return (
            prerequisiteStatus !== undefined &&
            prerequisiteStatus !== 'approved'
          )
        },
      )

    if (missingPrerequisites.length > 0) {
      return {
        label: 'Bloqueada',
        className: 'blocked',
      }
    }

    if (currentStatus === 'in-progress') {
      return {
        label: 'En curso',
        className: 'in-progress',
      }
    }

    return {
      label: 'Disponible',
      className: 'available',
    }
  }

  const approvedVisibleSubjects = visibleSubjects.filter(
    (subject) =>
      subjectStatuses[subject.code] === 'approved',
  )

  const activeVisibleSubjects = visibleSubjects.filter(
    (subject) =>
      subjectStatuses[subject.code] !== 'approved',
  )

  const approvedVisibleCredits = approvedVisibleSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  )

  const renderSubjectCard = (subject: Subject) => {
    const hasPrerequisites =
      subject.prerequisites.length > 0

    const currentStatus =
      subjectStatuses[subject.code] ?? 'pending'

    const academicRecord =
      subjectAcademicRecords[subject.code] ?? {
        repeatLevel: 0 as const,
        approvedRepeatLevel: null,
        failedAttempts: 0,
        attempts: [],
      }

    const approvedRepeatLevel =
      getApprovedRepeatLevel(academicRecord)

    const displayedRepeatLevel =
      currentStatus === 'approved'
        ? approvedRepeatLevel
        : academicRecord.repeatLevel

    const repeatLabel = getRepeatLabel(
      displayedRepeatLevel,
    )

    const approvedButtonLabel = getStatusLabel(
      'approved',
      currentStatus === 'approved'
        ? approvedRepeatLevel
        : academicRecord.repeatLevel,
    )

    const restrictedByConditionalEnrollment =
      conditionalEnrollmentActive &&
      academicRecord.repeatLevel === 0 &&
      currentStatus !== 'approved'

    const statusChangesBlocked =
      lostRightToContinue ||
      restrictedByConditionalEnrollment

    const unlockedSubjects =
      unlockedSubjectsByCode[subject.code] ?? []

    const unlocksSubjects =
      unlockedSubjects.length > 0

    const missingPrerequisites =
      subject.prerequisites.filter(
        (prerequisiteCode) => {
          const prerequisiteStatus =
            subjectStatuses[prerequisiteCode]

          return (
            prerequisiteStatus !== undefined &&
            prerequisiteStatus !== 'approved'
          )
        },
      )

    /*
     * Una materia ya aprobada no se bloquea nuevamente.
     *
     * Esto evita perder accidentalmente el progreso
     * guardado si luego se cambia un prerrequisito.
     */
    const isLocked =
      currentStatus !== 'approved' &&
      missingPrerequisites.length > 0

    const missingPrerequisiteNames =
      missingPrerequisites.map(
        (prerequisiteCode) =>
          getPrerequisiteName(
            prerequisiteCode,
          ),
      )

    return (
      <article
        className={`subject-card subject-card--${currentStatus} ${isLocked
          ? 'subject-card--blocked'
          : ''
          }`}
        key={subject.code}
      >
        <div className="subject-card__top">
          <div className="subject-card__information">
            <div className="subject-card__code-row">
              <span className="subject-card__code">
                {subject.code}
              </span>

              <span
                className={`subject-card__status ${isLocked
                  ? 'subject-card__status--blocked'
                  : `subject-card__status--${currentStatus}`
                  }`}
              >
                {isLocked
                  ? 'Bloqueada'
                  : getStatusLabel(
                    currentStatus,
                    approvedRepeatLevel,
                  )}
              </span>

              {repeatLabel && (
                <span
                  className={`subject-card__repeat subject-card__repeat--${repeatLabel.toLowerCase()}`}
                  title={`Nivel de repetición: ${repeatLabel}`}
                >
                  {repeatLabel}
                </span>
              )}
            </div>

            <h4>{subject.name}</h4>
          </div>

          <span className="subject-card__credits">
            {subject.credits}{' '}
            {subject.credits === 1
              ? 'crédito'
              : 'créditos'}
          </span>
        </div>

        {isLocked && (
          <div className="subject-card__lock-message">
            <span
              className="subject-card__lock-icon"
              aria-hidden="true"
            >
              <LuLockKeyhole />
            </span>

            <div>
              <strong>
                Materia bloqueada
              </strong>

              <span>
                Aprueba primero:{' '}
                {missingPrerequisiteNames.join(
                  ', ',
                )}
              </span>
            </div>
          </div>
        )}

        {restrictedByConditionalEnrollment &&
          !isLocked && (
            <div className="subject-card__regulatory-message">
              <LuLockKeyhole aria-hidden="true" />

              <div>
                <strong>Restricción reglamentaria</strong>
                <span>
                  Esta materia está en intento regular y
                  no puede cursarse durante una matrícula
                  condicional.
                </span>
              </div>
            </div>
          )}

        {lostRightToContinue && !isLocked && (
          <div className="subject-card__regulatory-message subject-card__regulatory-message--critical">
            <LuCircleAlert aria-hidden="true" />

            <div>
              <strong>Cambios académicos bloqueados</strong>
              <span>
                El historial registra pérdida del derecho
                a continuar estudios.
              </span>
            </div>
          </div>
        )}

        <div
          className="status-selector"
          role="group"
          aria-label={`Estado de ${subject.name}`}
        >
          <button
            className={`status-selector__button ${currentStatus === 'pending'
              ? 'status-selector__button--active-pending'
              : ''
              }`}
            type="button"
            onClick={() =>
              onStatusChange(
                subject.code,
                'pending',
              )
            }
          >
            Pendiente
          </button>

          <button
            className={`status-selector__button ${currentStatus === 'in-progress'
              ? 'status-selector__button--active-progress'
              : ''
              }`}
            type="button"
            disabled={isLocked || statusChangesBlocked}
            title={
              isLocked
                ? 'Aprueba primero los prerrequisitos.'
                : lostRightToContinue
                  ? 'El historial registra pérdida del derecho a continuar.'
                  : restrictedByConditionalEnrollment
                    ? 'La matrícula condicional solo permite materias en repetición.'
                    : undefined
            }
            onClick={() =>
              onStatusChange(
                subject.code,
                'in-progress',
              )
            }
          >
            En curso
          </button>

          <button
            className={`status-selector__button ${currentStatus === 'approved'
              ? 'status-selector__button--active-approved'
              : ''
              }`}
            type="button"
            disabled={isLocked || statusChangesBlocked}
            title={
              isLocked
                ? 'Aprueba primero los prerrequisitos.'
                : lostRightToContinue
                  ? 'El historial registra pérdida del derecho a continuar.'
                  : restrictedByConditionalEnrollment
                    ? 'La matrícula condicional solo permite materias en repetición.'
                    : undefined
            }
            onClick={() =>
              onStatusChange(
                subject.code,
                'approved',
              )
            }
          >
            {approvedButtonLabel}
          </button>
        </div>

        <button
          className="subject-card__failure-button"
          type="button"
          disabled={
            currentStatus !== 'in-progress' ||
            isLocked ||
            lostRightToContinue
          }
          title={
            currentStatus !== 'in-progress'
              ? 'Primero marca la materia como En curso.'
              : lostRightToContinue
                ? 'El historial registra pérdida del derecho a continuar.'
                : 'Registrar la pérdida definitiva de esta materia.'
          }
          onClick={() =>
            onRegisterFailure(subject)
          }
        >
          <LuCircleAlert aria-hidden="true" />
          Registrar pérdida
        </button>

        {hasPrerequisites ? (
          <details className="prerequisites">
            <summary className="prerequisites__summary">
              <span
                className="prerequisites__toggle-icon"
                aria-hidden="true"
              >
                <LuPlus className="prerequisites__icon--closed" />
                <LuMinus className="prerequisites__icon--open" />
              </span>

              <span>Ver prerrequisitos</span>

              <span className="prerequisites__count">
                {subject.prerequisites.length}
              </span>
            </summary>

            <ul className="prerequisites__list">
              {subject.prerequisites.map(
                (prerequisiteCode) => {
                  const prerequisiteStatusClass =
                    getPrerequisiteStatusClass(
                      prerequisiteCode,
                    )

                  return (
                    <li
                      className="prerequisites__item"
                      key={prerequisiteCode}
                    >
                      <span className="prerequisites__code">
                        {prerequisiteCode}
                      </span>

                      <span className="prerequisites__name">
                        {getPrerequisiteName(
                          prerequisiteCode,
                        )}
                      </span>

                      <span
                        className={`prerequisites__status prerequisites__status--${prerequisiteStatusClass}`}
                      >
                        {getPrerequisiteStatusLabel(
                          prerequisiteCode,
                        )}
                      </span>
                    </li>
                  )
                },
              )}
            </ul>
          </details>
        ) : (
          <p className="subject-card__no-prerequisites">
            Sin prerrequisitos
          </p>
        )}

        {unlocksSubjects && (
          <details className="unlocks">
            <summary className="unlocks__summary">
              <span
                className="unlocks__toggle-icon"
                aria-hidden="true"
              >
                <LuArrowDown />
              </span>

              <span>Materias que desbloquea</span>

              <span className="unlocks__count">
                {unlockedSubjects.length}
              </span>
            </summary>

            <ul className="unlocks__list">
              {unlockedSubjects.map(
                (unlockedSubject) => {
                  const unlockedSubjectState =
                    getUnlockedSubjectState(
                      unlockedSubject,
                    )

                  return (
                    <li
                      className="unlocks__item"
                      key={unlockedSubject.code}
                    >
                      <div className="unlocks__information">
                        <span className="unlocks__code">
                          {unlockedSubject.code}
                        </span>

                        <span className="unlocks__name">
                          {unlockedSubject.name}
                        </span>
                      </div>

                      <span
                        className={`unlocks__status unlocks__status--${unlockedSubjectState.className}`}
                      >
                        {unlockedSubjectState.label}
                      </span>
                    </li>
                  )
                },
              )}
            </ul>
          </details>
        )}
      </article>
    )
  }

  return (
    <article
      className={`semester-card ${isAdditionalSection
        ? 'semester-card--additional'
        : ''
        } ${isSemesterCompleted
          ? 'semester-card--completed'
          : ''
        }`}
    >
      <header className="semester-card__header">
        <div>
          <span className="semester-card__label">
            {isAdditionalSection
              ? 'Componente complementario'
              : `Nivel ${section.semester}`}
          </span>

          <h3>{section.title}</h3>
        </div>

        <div className="semester-card__actions">
          <div className="semester-card__credits">
            <strong>{semesterCredits}</strong>
            <span>créditos</span>
          </div>

          {!isAdditionalSection && (
            <button
              className="semester-card__approve-button"
              type="button"
              onClick={onApproveAll}
              disabled={allSubjectsApproved}
              title={
                hasLockedSubjects
                  ? 'Consulta qué prerrequisitos faltan para aprobar todo el semestre.'
                  : 'Marcar todas las materias del semestre como aprobadas.'
              }
            >
              {allSubjectsApproved ? (
                <>
                  <LuCircleCheck aria-hidden="true" />
                  Todo aprobado
                </>
              ) : hasLockedSubjects ? (
                <>
                  <LuCircleAlert aria-hidden="true" />
                  Revisar requisitos
                </>
              ) : (
                <>
                  <LuCheckCheck aria-hidden="true" />
                  Aprobar todo
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <section
        className="semester-progress"
        aria-label={`Progreso de ${section.title}`}
      >
        <div className="semester-progress__heading">
          <div>
            <span className="semester-progress__label">
              Progreso del semestre
            </span>

            <strong className="semester-progress__percentage">
              {semesterProgressPercentage} %
            </strong>
          </div>

          {isSemesterCompleted && (
            <span className="semester-progress__completed">
              <LuCircleCheck aria-hidden="true" />
              Completado
            </span>
          )}
        </div>

        <div
          className="semester-progress__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={semesterProgressPercentage}
          aria-label={`${semesterProgressPercentage} por ciento completado`}
        >
          <div
            className="semester-progress__bar-value"
            style={{
              width: `${semesterProgressPercentage}%`,
            }}
          />
        </div>

        <div className="semester-progress__statistics">
          <div className="semester-progress__statistic">
            <strong>
              {approvedSemesterCredits} / {semesterCredits}
            </strong>

            <span>créditos aprobados</span>
          </div>

          <div className="semester-progress__divider" />

          <div className="semester-progress__statistic">
            <strong>
              {approvedSubjectsCount} /{' '}
              {section.subjects.length}
            </strong>

            <span>materias aprobadas</span>
          </div>
        </div>
      </section>

      <div className="subject-list">
        {activeVisibleSubjects.map(renderSubjectCard)}

        {approvedVisibleSubjects.length > 0 && (
          <details className="approved-subjects">
            <summary className="approved-subjects__summary">
              <span
                className="approved-subjects__icon"
                aria-hidden="true"
              >
                <LuCircleCheck />
              </span>

              <span className="approved-subjects__copy">
                <strong>Materias aprobadas</strong>

                <small>
                  Se agrupan aquí para mantener el semestre compacto.
                </small>
              </span>

              <span className="approved-subjects__metrics">
                <strong>{approvedVisibleSubjects.length}</strong>

                <small>
                  {approvedVisibleCredits}{' '}
                  {approvedVisibleCredits === 1
                    ? 'crédito'
                    : 'créditos'}
                </small>
              </span>

              <span
                className="approved-subjects__toggle"
                aria-hidden="true"
              >
                <LuPlus className="approved-subjects__toggle-closed" />
                <LuMinus className="approved-subjects__toggle-open" />
              </span>
            </summary>

            <div className="approved-subjects__list">
              {approvedVisibleSubjects.map(renderSubjectCard)}
            </div>
          </details>
        )}
      </div>
    </article>
  )
}

export default SemesterCard