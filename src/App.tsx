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
    const availableSubjects = section.subjects.filter(
      (subject) => {
        const currentStatus =
          subjectStatuses[subject.code] ?? 'pending'

        if (currentStatus === 'approved') {
          return true
        }

        return subject.prerequisites.every(
          (prerequisiteCode) => {
            const prerequisiteStatus =
              subjectStatuses[prerequisiteCode]

            return (
              prerequisiteStatus === undefined ||
              prerequisiteStatus === 'approved'
            )
          },
        )
      },
    )

    if (
      availableSubjects.length !==
      section.subjects.length
    ) {
      await Swal.fire({
        icon: 'warning',
        title: 'Hay materias bloqueadas',
        text:
          'Debes aprobar primero los prerrequisitos antes de aprobar todo el semestre.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5',
      })

      return
    }

    const result = await Swal.fire({
      icon: 'question',
      title: `¿Aprobar todo ${section.title}?`,
      html: `
        <p>
          Se marcarán como aprobadas las
          <strong>${section.subjects.length} materias</strong>
          de este semestre.
        </p>
        <p>Esta acción puede modificarse posteriormente.</p>
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
      text: 'Las materias fueron actualizadas.',
      showConfirmButton: false,
      timer: 2200,
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