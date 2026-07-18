import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import './App.css'

import DegreeRequirementsCard from './components/DegreeRequirementsCard'
import SemesterCard from './components/SemesterCard'

import { curriculum } from './data/curriculum'
import { degreeRequirements } from './data/degreeRequirements'
import { externalPrerequisiteNames } from './data/prerequisites'

import { useLocalStorage } from './hooks/useLocalStorage'

import type {
  CurriculumSection,
  DegreeRequirement,
  DegreeRequirementStatus,
  Subject,
  SubjectStatus,
} from './types/curriculum'

type SubjectFilter =
  | 'all'
  | 'pending'
  | 'in-progress'
  | 'approved'
  | 'blocked'

const escapeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function App() {
  /*
   * =====================================================
   * INFORMACIÓN GENERAL DEL PENSUM
   * =====================================================
   */

  const allSubjects = curriculum.flatMap(
    (section) => section.subjects,
  )

  const totalSubjects = allSubjects.length

  const totalCredits = allSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  )

  /*
   * =====================================================
   * ESTADOS DE LAS MATERIAS
   * =====================================================
   */

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

  /*
   * Se combinan los estados iniciales con los guardados.
   *
   * Así, si se agrega una materia nueva al pensum,
   * comenzará automáticamente como pendiente.
   */
  const subjectStatuses: Record<string, SubjectStatus> = {
    ...initialStatuses,
    ...savedSubjectStatuses,
  }

  /*
   * =====================================================
   * ESTADOS DE LOS REQUISITOS DE GRADO
   * =====================================================
   */

  const initialDegreeRequirementStatuses: Record<
    string,
    DegreeRequirementStatus
  > = Object.fromEntries(
    degreeRequirements.map((requirement) => [
      requirement.code,
      'pending' as DegreeRequirementStatus,
    ]),
  )

  const [
    savedDegreeRequirementStatuses,
    setSavedDegreeRequirementStatuses,
  ] = useLocalStorage<
    Record<string, DegreeRequirementStatus>
  >(
    'pensum-degree-requirements',
    initialDegreeRequirementStatuses,
  )

  const degreeRequirementStatuses: Record<
    string,
    DegreeRequirementStatus
  > = {
    ...initialDegreeRequirementStatuses,
    ...savedDegreeRequirementStatuses,
  }

  /*
   * =====================================================
   * FILTRO POR SEMESTRE
   * =====================================================
   */

  const [
    selectedSectionId,
    setSelectedSectionId,
  ] = useLocalStorage<string>(
    'pensum-selected-section',
    'all',
  )

  const [
    selectedStatusFilter,
    setSelectedStatusFilter,
  ] = useLocalStorage<SubjectFilter>(
    'pensum-status-filter',
    'all',
  )

  const [
    searchTerm,
    setSearchTerm,
  ] = useLocalStorage<string>(
    'pensum-search-term',
    '',
  )

  /*
   * Comprueba que el semestre guardado todavía exista.
   *
   * Si no existe, muestra todos los semestres.
   */
  const selectedSectionExists =
    selectedSectionId === 'all' ||
    curriculum.some(
      (section) => section.id === selectedSectionId,
    )

  const activeSectionId = selectedSectionExists
    ? selectedSectionId
    : 'all'

  /*
   * =====================================================
   * NOMBRES DE MATERIAS POR CÓDIGO
   * =====================================================
   */

  const subjectNamesByCode: Record<string, string> =
    Object.fromEntries(
      allSubjects.map((subject) => [
        subject.code,
        subject.name,
      ]),
    )

  /*
   * También se agregan los requisitos externos que no
   * pertenecen directamente a las 58 materias del pensum.
   */
  const prerequisiteNamesByCode: Record<string, string> = {
    ...subjectNamesByCode,
    ...externalPrerequisiteNames,
  }

  const normalizeSearchText = (value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  const getMissingPrerequisites = (
    subject: Subject,
  ) => {
    return subject.prerequisites.filter(
      (prerequisiteCode) => {
        const prerequisiteStatus =
          subjectStatuses[prerequisiteCode]

        /*
         * Los requisitos externos no existen dentro
         * de subjectStatuses y no bloquean la materia.
         */
        return (
          prerequisiteStatus !== undefined &&
          prerequisiteStatus !== 'approved'
        )
      },
    )
  }

  const isSubjectLocked = (subject: Subject) => {
    const currentStatus =
      subjectStatuses[subject.code] ?? 'pending'

    /*
     * Una materia ya aprobada no vuelve a mostrarse
     * como bloqueada.
     */
    if (currentStatus === 'approved') {
      return false
    }

    return getMissingPrerequisites(subject).length > 0
  }

  /*
   * =====================================================
   * CÁLCULOS DEL PROGRESO ACADÉMICO
   * =====================================================
   */

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

  const completedDegreeRequirements =
    degreeRequirements.filter(
      (requirement) =>
        degreeRequirementStatuses[
        requirement.code
        ] === 'completed',
    ).length

  const progressPercentage =
    totalCredits === 0
      ? 0
      : Math.round(
        (approvedCredits / totalCredits) * 100,
      )

  /*
   * =====================================================
   * PENSUM FILTRADO
   * =====================================================
   */

  const normalizedSearchTerm =
    normalizeSearchText(searchTerm)

  const sectionsSelectedBySemester =
    activeSectionId === 'all'
      ? curriculum
      : curriculum.filter(
        (section) =>
          section.id === activeSectionId,
      )

  const matchesStatusFilter = (
    subject: Subject,
  ) => {
    const currentStatus =
      subjectStatuses[subject.code] ?? 'pending'

    const subjectIsLocked =
      isSubjectLocked(subject)

    if (selectedStatusFilter === 'all') {
      return true
    }

    if (selectedStatusFilter === 'blocked') {
      return subjectIsLocked
    }

    /*
     * Una materia bloqueada se muestra únicamente
     * dentro del filtro "Bloqueadas".
     *
     * Así las categorías no se mezclan.
     */
    if (subjectIsLocked) {
      return false
    }

    return currentStatus === selectedStatusFilter
  }

  const filteredSections =
    sectionsSelectedBySemester
      .map((section) => {
        const visibleSubjects =
          section.subjects.filter((subject) => {
            const normalizedName =
              normalizeSearchText(subject.name)

            const normalizedCode =
              normalizeSearchText(subject.code)

            const matchesSearch =
              normalizedSearchTerm === '' ||
              normalizedName.includes(
                normalizedSearchTerm,
              ) ||
              normalizedCode.includes(
                normalizedSearchTerm,
              )

            return (
              matchesSearch &&
              matchesStatusFilter(subject)
            )
          })

        return {
          section,
          visibleSubjects,
        }
      })
      .filter(
        ({ visibleSubjects }) =>
          visibleSubjects.length > 0,
      )

  const visibleSubjectsCount =
    filteredSections.reduce(
      (total, { visibleSubjects }) =>
        total + visibleSubjects.length,
      0,
    )

  const hasActiveFilters =
    activeSectionId !== 'all' ||
    selectedStatusFilter !== 'all' ||
    normalizedSearchTerm !== ''

  const shouldShowDegreeRequirements =
    activeSectionId === 'all' &&
    selectedStatusFilter === 'all' &&
    normalizedSearchTerm === ''

  /*
   * =====================================================
   * CAMBIAR ESTADO DE UNA MATERIA
   * =====================================================
   */

  const handleClearFilters = () => {
    setSelectedSectionId('all')
    setSelectedStatusFilter('all')
    setSearchTerm('')
  }

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

  /*
   * =====================================================
   * CAMBIAR ESTADO DE UN REQUISITO DE GRADO
   * =====================================================
   */

  const handleDegreeRequirementStatusChange = async (
    requirement: DegreeRequirement,
    newStatus: DegreeRequirementStatus,
  ) => {
    const currentStatus =
      degreeRequirementStatuses[requirement.code] ??
      'pending'

    if (currentStatus === newStatus) {
      return
    }

    const isCompleting = newStatus === 'completed'

    const result = await Swal.fire({
      icon: isCompleting ? 'question' : 'warning',

      title: isCompleting
        ? '¿Marcar requisito como completado?'
        : '¿Volver este requisito a pendiente?',

      text: isCompleting
        ? `Se marcará "${requirement.name}" como completado.`
        : `Se quitará el estado completado de "${requirement.name}".`,

      showCancelButton: true,

      confirmButtonText: isCompleting
        ? 'Sí, completar'
        : 'Sí, volver a pendiente',

      cancelButtonText: 'Cancelar',

      confirmButtonColor: isCompleting
        ? '#16a34a'
        : '#f59e0b',

      cancelButtonColor: '#64748b',

      reverseButtons: true,
      focusCancel: true,
    })

    if (!result.isConfirmed) {
      return
    }

    setSavedDegreeRequirementStatuses(
      (currentStatuses) => ({
        ...initialDegreeRequirementStatuses,
        ...currentStatuses,
        [requirement.code]: newStatus,
      }),
    )

    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: isCompleting ? 'success' : 'info',

      title: isCompleting
        ? 'Requisito completado'
        : 'Requisito actualizado',

      text: requirement.name,

      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
    })
  }

  /*
   * =====================================================
   * APROBAR TODAS LAS MATERIAS DE UN SEMESTRE
   * =====================================================
   */

  const handleApproveSection = async (
    section: CurriculumSection,
  ) => {
    const blockedSubjects: Array<{
      subject: (typeof section.subjects)[number]
      missingPrerequisites: string[]
    }> = []

    /*
     * Se buscan las materias bloqueadas y los requisitos
     * que todavía no están aprobados.
     */
    section.subjects.forEach((subject) => {
      const currentStatus =
        subjectStatuses[subject.code] ?? 'pending'

      /*
       * Una materia ya aprobada no necesita revisarse.
       */
      if (currentStatus === 'approved') {
        return
      }

      const missingPrerequisites =
        subject.prerequisites.filter(
          (prerequisiteCode) => {
            const prerequisiteStatus =
              subjectStatuses[prerequisiteCode]

            /*
             * Los requisitos externos no aparecen dentro
             * de subjectStatuses.
             *
             * Por eso se muestran, pero no bloquean
             * permanentemente la materia.
             */
            return (
              prerequisiteStatus !== undefined &&
              prerequisiteStatus !== 'approved'
            )
          },
        )

      if (missingPrerequisites.length > 0) {
        blockedSubjects.push({
          subject,
          missingPrerequisites,
        })
      }
    })

    /*
     * Si existen materias bloqueadas, SweetAlert muestra
     * cuáles son y qué prerrequisitos faltan.
     */
    if (blockedSubjects.length > 0) {
      const blockedSubjectsHtml = blockedSubjects
        .map(({ subject, missingPrerequisites }) => {
          const prerequisitesHtml =
            missingPrerequisites
              .map((prerequisiteCode) => {
                const prerequisiteName =
                  prerequisiteNamesByCode[
                  prerequisiteCode
                  ] ?? 'Materia no registrada'

                const prerequisiteStatus =
                  subjectStatuses[
                  prerequisiteCode
                  ] ?? 'pending'

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
              En
              <strong>
                ${escapeHtml(section.title)}
              </strong>
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

    /*
     * Solo se cuentan las materias que todavía no están
     * aprobadas.
     */
    const subjectsNotApproved =
      section.subjects.filter(
        (subject) =>
          subjectStatuses[subject.code] !== 'approved',
      )

    const creditsToApprove =
      subjectsNotApproved.reduce(
        (total, subject) =>
          total + subject.credits,
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

      text: `${subjectsNotApproved.length} ${subjectsNotApproved.length === 1
        ? 'materia fue actualizada'
        : 'materias fueron actualizadas'
        }.`,

      showConfirmButton: false,
      timer: 2400,
      timerProgressBar: true,
    })
  }

  /*
   * =====================================================
   * REINICIAR TODO EL PROGRESO
   * =====================================================
   */

  const handleResetProgress = async () => {
    const changedSubjects = allSubjects.filter(
      (subject) =>
        subjectStatuses[subject.code] !== 'pending',
    ).length

    const changedDegreeRequirements =
      degreeRequirements.filter(
        (requirement) =>
          degreeRequirementStatuses[
          requirement.code
          ] !== 'pending',
      ).length

    if (
      changedSubjects === 0 &&
      changedDegreeRequirements === 0
    ) {
      await Swal.fire({
        icon: 'info',
        title: 'No hay progreso para reiniciar',
        text:
          'Todas las materias y requisitos de grado se encuentran pendientes.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5',
      })

      return
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Reiniciar todo el progreso?',

      html: `
        <div class="swal-confirmation-content">
          <p>
            Se reiniciarán
            <strong>
              ${changedSubjects}
              ${changedSubjects === 1
          ? 'materia'
          : 'materias'
        }
            </strong>.
          </p>

          <p>
            También se reiniciarán
            <strong>
              ${changedDegreeRequirements}
              ${changedDegreeRequirements === 1
          ? 'requisito de grado'
          : 'requisitos de grado'
        }
            </strong>.
          </p>

          <p>
            Todos volverán al estado pendiente.
          </p>

          <p>
            <strong>
              Esta acción no se puede deshacer.
            </strong>
          </p>
        </div>
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

    setSavedDegreeRequirementStatuses(
      initialDegreeRequirementStatuses,
    )

    setSelectedSectionId('all')
    setSelectedStatusFilter('all')
    setSearchTerm('')

    await Swal.fire({
      icon: 'success',
      title: 'Progreso reiniciado',
      text:
        'Todas las materias y requisitos de grado volvieron al estado pendiente.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#4f46e5',
    })
  }

  /*
   * =====================================================
   * INTERFAZ
   * =====================================================
   */

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
              Organiza tus materias, consulta los
              prerrequisitos y lleva el control de tu
              avance académico.
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
        {/*
         * =================================================
         * RESUMEN ACADÉMICO
         * =================================================
         */}

        <section
          className="summary summary--four"
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
              Del programa completado
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
              {inProgressSubjects}{' '}
              {inProgressSubjects === 1
                ? 'materia en curso'
                : 'materias en curso'}
              {' · '}
              {totalSubjects} materias en total
            </span>
          </article>

          <article className="summary-card">
            <span className="summary-card__label">
              Requisitos de grado
            </span>

            <strong className="summary-card__value">
              {completedDegreeRequirements} /{' '}
              {degreeRequirements.length}
            </strong>

            <span className="summary-card__detail">
              No suman créditos
            </span>
          </article>
        </section>

        {/*
         * =================================================
         * PLAN DE ESTUDIOS
         * =================================================
         */}

        <section className="curriculum">
          <div className="section-heading section-heading--filters">
            <div className="section-heading__information">
              <p className="section-heading__eyebrow">
                Plan de estudios
              </p>

              <h2>Materias por semestre</h2>

              <p className="section-heading__description">
                Busca una materia o combina los filtros
                para revisar tu progreso.
              </p>
            </div>

            <div
              className="curriculum-filters"
              aria-label="Filtros del pensum"
            >
              <div className="curriculum-filter curriculum-filter--search">
                <label
                  className="curriculum-filter__label"
                  htmlFor="subject-search"
                >
                  Buscar materia
                </label>

                <input
                  id="subject-search"
                  className="curriculum-filter__input"
                  type="search"
                  value={searchTerm}
                  placeholder="Nombre o código"
                  autoComplete="off"
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                />
              </div>

              <div className="curriculum-filter">
                <label
                  className="curriculum-filter__label"
                  htmlFor="semester-filter"
                >
                  Semestre
                </label>

                <select
                  id="semester-filter"
                  className="curriculum-filter__select"
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

              <div className="curriculum-filter">
                <label
                  className="curriculum-filter__label"
                  htmlFor="status-filter"
                >
                  Estado
                </label>

                <select
                  id="status-filter"
                  className="curriculum-filter__select"
                  value={selectedStatusFilter}
                  onChange={(event) =>
                    setSelectedStatusFilter(
                      event.target.value as SubjectFilter,
                    )
                  }
                >
                  <option value="all">
                    Todas las materias
                  </option>

                  <option value="pending">
                    Pendientes
                  </option>

                  <option value="in-progress">
                    En curso
                  </option>

                  <option value="approved">
                    Aprobadas
                  </option>

                  <option value="blocked">
                    Bloqueadas
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="status-legend" aria-label="Estados de las materias">
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

          <div className="filter-results">
            <p className="filter-results__text">
              Mostrando{' '}
              <strong>{visibleSubjectsCount}</strong>{' '}
              {visibleSubjectsCount === 1
                ? 'materia'
                : 'materias'}{' '}
              de <strong>{totalSubjects}</strong>
            </p>

            {hasActiveFilters && (
              <button
                className="filter-results__clear"
                type="button"
                onClick={handleClearFilters}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {filteredSections.length > 0 ? (
            <div className="curriculum-grid">
              {filteredSections.map(
                ({ section, visibleSubjects }) => (
                  <SemesterCard
                    key={section.id}
                    section={section}
                    visibleSubjects={visibleSubjects}
                    prerequisiteNamesByCode={
                      prerequisiteNamesByCode
                    }
                    subjectStatuses={subjectStatuses}
                    onStatusChange={handleStatusChange}
                    onApproveAll={() =>
                      handleApproveSection(section)
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <div className="curriculum-empty">
              <div
                className="curriculum-empty__icon"
                aria-hidden="true"
              >
                ⌕
              </div>

              <h3>No encontramos materias</h3>

              <p>
                No hay materias que coincidan con la
                búsqueda y los filtros seleccionados.
              </p>

              <button
                type="button"
                onClick={handleClearFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>

        {shouldShowDegreeRequirements && (
          <DegreeRequirementsCard
            requirements={degreeRequirements}
            requirementStatuses={
              degreeRequirementStatuses
            }
            onStatusChange={
              handleDegreeRequirementStatusChange
            }
          />
        )}
      </main>
    </div>
  )
}

export default App