import Swal from 'sweetalert2'
import './App.css'
import SemesterCard from './components/SemesterCard'
import { curriculum } from './data/curriculum'
import { externalPrerequisiteNames } from './data/prerequisites'
import { useLocalStorage } from './hooks/useLocalStorage'
import type {
  CurriculumSection,
  SubjectStatus,
} from './types/curriculum'

const escapeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function App() {
  const allSubjects = curriculum.flatMap(
    (section) => section.subjects,
  )

  const totalSubjects = allSubjects.length

  const totalCredits = allSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  )

  const initialStatuses: Record<string, SubjectStatus> =
    Object.fromEntries(
      allSubjects.map((subject) => [
        subject.code,
        'pending' as SubjectStatus,
      ]),
    )

  const [
    savedSubjectStatuses,
    setSavedSubjectStatuses,
  ] = useLocalStorage<Record<string, SubjectStatus>>(
    'pensum-subject-statuses',
    initialStatuses,
  )

  const subjectStatuses: Record<string, SubjectStatus> = {
    ...initialStatuses,
    ...savedSubjectStatuses,
  }

  const [
    selectedSectionId,
    setSelectedSectionId,
  ] = useLocalStorage<string>(
    'pensum-selected-section',
    'all',
  )

  const selectedSectionExists =
    selectedSectionId === 'all' ||
    curriculum.some(
      (section) => section.id === selectedSectionId,
    )

  const activeSectionId = selectedSectionExists
    ? selectedSectionId
    : 'all'

  const subjectNamesByCode: Record<string, string> =
    Object.fromEntries(
      allSubjects.map((subject) => [
        subject.code,
        subject.name,
      ]),
    )

  const prerequisiteNamesByCode: Record<string, string> = {
    ...subjectNamesByCode,
    ...externalPrerequisiteNames,
  }

  const approvedSubjects = allSubjects.filter(
    (subject) =>
      subjectStatuses[subject.code] === 'approved',
  )

  const approvedCredits = approvedSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  )

  const pendingSubjects = allSubjects.filter(
    (subject) =>
      subjectStatuses[subject.code] === 'pending',
  ).length

  const inProgressSubjects = allSubjects.filter(
    (subject) =>
      subjectStatuses[subject.code] === 'in-progress',
  ).length

  const progressPercentage =
    totalCredits === 0
      ? 0
      : Math.round(
        (approvedCredits / totalCredits) * 100,
      )

  const filteredCurriculum =
    activeSectionId === 'all'
      ? curriculum
      : curriculum.filter(
        (section) => section.id === activeSectionId,
      )

  const handleStatusChange = (
    subjectCode: string,
    newStatus: SubjectStatus,
  ) => {
    setSavedSubjectStatuses((currentStatuses) => ({
      ...initialStatuses,
      ...currentStatuses,
      [subjectCode]: newStatus,
    }))
  }

  const handleApproveSection = async (
    section: CurriculumSection,
  ) => {
    const blockedSubjects = section.subjects
      .map((subject) => {
        const currentStatus =
          subjectStatuses[subject.code] ?? 'pending'

        if (currentStatus === 'approved') {
          return null
        }

        const missingPrerequisites =
          subject.prerequisites.filter(
            (prerequisiteCode) => {
              const prerequisiteStatus =
                subjectStatuses[prerequisiteCode]

              /*
               * Los requisitos externos no están guardados
               * en subjectStatuses y no bloquean la materia.
               */
              return (
                prerequisiteStatus !== undefined &&
                prerequisiteStatus !== 'approved'
              )
            },
          )

        if (missingPrerequisites.length === 0) {
          return null
        }

        return {
          subject,
          missingPrerequisites,
        }
      })
      .filter(
        (
          blockedSubject,
        ): blockedSubject is {
          subject: (typeof section.subjects)[number]
          missingPrerequisites: string[]
        } => blockedSubject !== null,
      )

    if (blockedSubjects.length > 0) {
      const blockedSubjectsHtml = blockedSubjects
        .map(({ subject, missingPrerequisites }) => {
          const prerequisitesHtml = missingPrerequisites
            .map((prerequisiteCode) => {
              const prerequisiteName =
                prerequisiteNamesByCode[
                prerequisiteCode
                ] ?? 'Materia no registrada'

              const prerequisiteStatus =
                subjectStatuses[prerequisiteCode] ??
                'pending'

              const statusLabel =
                prerequisiteStatus === 'in-progress'
                  ? 'En curso'
                  : 'Pendiente'

              return `
              <li class="swal-requirement">
                <span class="swal-requirement__code">
                  ${escapeHtml(prerequisiteCode)}
                </span>

                <span class="swal-requirement__information">
                  <strong>
                    ${escapeHtml(prerequisiteName)}
                  </strong>

                  <small>
                    Estado actual: ${statusLabel}
                  </small>
                </span>
              </li>
            `
            })
            .join('')

          return `
          <section class="swal-blocked-subject">
            <div class="swal-blocked-subject__heading">
              <span class="swal-blocked-subject__code">
                ${escapeHtml(subject.code)}
              </span>

              <strong>
                ${escapeHtml(subject.name)}
              </strong>
            </div>

            <p>Necesita que apruebes:</p>

            <ul class="swal-requirements-list">
              ${prerequisitesHtml}
            </ul>
          </section>
        `
        })
        .join('')

      await Swal.fire({
        icon: 'warning',
        title: 'No se puede aprobar todo todavía',
        html: `
        <div class="swal-blocked-content">
          <p class="swal-blocked-content__intro">
            En <strong>${escapeHtml(section.title)}</strong>
            hay
            <strong>
              ${blockedSubjects.length}
              ${blockedSubjects.length === 1
            ? 'materia bloqueada'
            : 'materias bloqueadas'
          }
            </strong>.
          </p>

          <div class="swal-blocked-list">
            ${blockedSubjectsHtml}
          </div>

          <p class="swal-blocked-content__footer">
            Ningún estado fue modificado.
          </p>
        </div>
      `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5',
        width: 680,
        customClass: {
          popup: 'swal-pensum-popup',
          htmlContainer: 'swal-pensum-container',
        },
      })

      return
    }

    const subjectsNotApproved = section.subjects.filter(
      (subject) =>
        subjectStatuses[subject.code] !== 'approved',
    )

    const creditsToApprove = subjectsNotApproved.reduce(
      (total, subject) => total + subject.credits,
      0,
    )

    const result = await Swal.fire({
      icon: 'question',
      title: `¿Aprobar todo ${section.title}?`,
      html: `
      <div class="swal-confirmation-content">
        <p>
          Se marcarán como aprobadas
          <strong>
            ${subjectsNotApproved.length}
            ${subjectsNotApproved.length === 1
          ? 'materia'
          : 'materias'
        }
          </strong>.
        </p>

        <p>
          Esto agregará
          <strong>
            ${creditsToApprove}
            ${creditsToApprove === 1
          ? 'crédito'
          : 'créditos'
        }
          </strong>
          a tu progreso.
        </p>

        <p>
          Después podrás modificar cada materia
          individualmente.
        </p>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    })

    if (!result.isConfirmed) {
      return
    }

    setSavedSubjectStatuses((currentStatuses) => {
      const updatedStatuses = {
        ...initialStatuses,
        ...currentStatuses,
      }

      section.subjects.forEach((subject) => {
        updatedStatuses[subject.code] = 'approved'
      })

      return updatedStatuses
    })

    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `${section.title} aprobado`,
      text: `${subjectsNotApproved.length} materias fueron actualizadas.`,
      showConfirmButton: false,
      timer: 2400,
      timerProgressBar: true,
    })
  }

  const handleResetProgress = async () => {
    const changedSubjects = allSubjects.filter(
      (subject) =>
        subjectStatuses[subject.code] !== 'pending',
    ).length

    if (changedSubjects === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'No hay progreso para reiniciar',
        text:
          'Todas las materias ya se encuentran en estado pendiente.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5',
      })

      return
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Reiniciar todo el progreso?',
      html: `
        <p>
          Se eliminarán los estados guardados de
          <strong>${changedSubjects} materias</strong>.
        </p>
        <p>
          Las materias volverán a aparecer como pendientes.
        </p>
        <p>
          <strong>Esta acción no se puede deshacer.</strong>
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Conservar progreso',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    })

    if (!result.isConfirmed) {
      return
    }

    setSavedSubjectStatuses(initialStatuses)
    setSelectedSectionId('all')

    await Swal.fire({
      icon: 'success',
      title: 'Progreso reiniciado',
      text:
        'Todas las materias volvieron al estado pendiente.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4f46e5',
    })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__content">
          <div className="header__intro">
            <p className="header__career">
              Ingeniería Electrónica y Telecomunicaciones
            </p>

            <h1>Mi pensum interactivo</h1>

            <p className="header__description">
              Organiza tus materias, consulta los prerrequisitos
              y lleva el control de tu avance académico.
            </p>
          </div>

          <button
            className="header__reset-button"
            type="button"
            onClick={handleResetProgress}
          >
            <span aria-hidden="true">↻</span>
            Reiniciar progreso
          </button>
        </div>
      </header>

      <main className="main-content">
        <section
          className="summary"
          aria-label="Resumen académico"
        >
          <article className="summary-card">
            <span className="summary-card__label">
              Progreso
            </span>

            <strong className="summary-card__value">
              {progressPercentage} %
            </strong>

            <div
              className="progress-bar"
              aria-label={`Progreso académico: ${progressPercentage} por ciento`}
            >
              <div
                className="progress-bar__value"
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>

            <span className="summary-card__detail">
              De {totalSubjects} materias · {inProgressSubjects} en curso
            </span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">
              Créditos aprobados
            </span>

            <strong className="summary-card__value">
              {approvedCredits} / {totalCredits}
            </strong>

            <span className="summary-card__detail">
              Créditos acumulados
            </span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">
              Materias pendientes
            </span>

            <strong className="summary-card__value">
              {pendingSubjects}
            </strong>

            <span className="summary-card__detail">
              {inProgressSubjects} materias en curso
            </span>
          </article>
        </section>

        <section className="curriculum">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">
                Plan de estudios
              </p>

              <h2>Materias por semestre</h2>
            </div>

            <div className="semester-filter">
              <label
                className="semester-filter__label"
                htmlFor="semester-filter"
              >
                Filtrar por semestre
              </label>

              <select
                id="semester-filter"
                className="semester-filter__select"
                value={activeSectionId}
                onChange={(event) =>
                  setSelectedSectionId(event.target.value)
                }
              >
                <option value="all">
                  Todos los semestres
                </option>

                {curriculum.map((section) => (
                  <option
                    value={section.id}
                    key={section.id}
                  >
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="status-legend">
            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--pending" />
              Pendiente
            </div>

            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--progress" />
              En curso
            </div>

            <div className="status-legend__item">
              <span className="status-legend__dot status-legend__dot--approved" />
              Aprobada
            </div>
          </div>

          <div className="curriculum-grid">
            {filteredCurriculum.map((section) => (
              <SemesterCard
                key={section.id}
                section={section}
                prerequisiteNamesByCode={
                  prerequisiteNamesByCode
                }
                subjectStatuses={subjectStatuses}
                onStatusChange={handleStatusChange}
                onApproveAll={() =>
                  handleApproveSection(section)
                }
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App