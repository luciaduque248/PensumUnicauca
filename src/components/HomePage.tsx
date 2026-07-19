/* eslint-disable react-hooks/set-state-in-effect */
import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

import Swal from "sweetalert2";

import {
    LuGraduationCap,
    LuPencil,
    LuSave,
    LuX,
} from "react-icons/lu";

import type {
    StudentAcademicStatus,
    StudentAdmissionPeriod,
    StudentProfile,
} from "../types/studentProfile";

interface HomePageProps {
    studentProfile: StudentProfile;

    onSaveProfile: (
        profile: StudentProfile,
    ) => void | Promise<void>;
}

const academicStatusLabels: Record<
    StudentAcademicStatus,
    string
> = {
    active: "Activo",
    inactive: "Inactivo",
    suspended: "Suspendido",
    graduated: "Graduado",
    other: "Otro",
};

const copyStudentProfile = (
    profile: StudentProfile,
): StudentProfile => {
    return {
        ...profile,

        freeTuition: {
            ...profile.freeTuition,
        },

        personalInformation: {
            ...profile.personalInformation,
        },
    };
};

const parseOptionalNumber = (
    value: string,
): number | null => {
    if (value.trim() === "") {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue)
        ? parsedValue
        : null;
};

const currentYear =
    new Date().getFullYear();

const isValidAcademicAverage = (
    value: string,
) => {
    if (value.trim() === "") {
        return true;
    }

    const parsedValue = Number(value);

    return (
        Number.isFinite(parsedValue) &&
        parsedValue >= 0 &&
        parsedValue <= 5
    );
};

function HomePage({
    studentProfile,
    onSaveProfile,
}: HomePageProps) {
    const [formProfile, setFormProfile] =
        useState<StudentProfile>(() =>
            copyStudentProfile(studentProfile),
        );

    const [isEditing, setIsEditing] =
        useState(!studentProfile.isConfigured);

    useEffect(() => {
        setFormProfile(
            copyStudentProfile(studentProfile),
        );

        if (!studentProfile.isConfigured) {
            setIsEditing(true);
        }
    }, [studentProfile]);

    const handleCancelEditing = () => {
        if (!studentProfile.isConfigured) {
            return;
        }

        setFormProfile(
            copyStudentProfile(studentProfile),
        );

        setIsEditing(false);
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        const fullName =
            formProfile.fullName.trim();

        const university =
            formProfile.university.trim();

        const program =
            formProfile.program.trim();

        const studentCode =
            formProfile.studentCode.trim();

        if (
            fullName === "" ||
            university === "" ||
            program === "" ||
            studentCode === "" ||
            formProfile.currentSemester === null ||
            formProfile.admissionYear === null ||
            formProfile.admissionPeriod === ""
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Completa la información principal",
                text:
                    "Debes ingresar nombre, código estudiantil, semestre actual, año de ingreso y periodo de ingreso.",
                confirmButtonText: "Revisar formulario",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        if (
            formProfile.currentSemester < 1 ||
            formProfile.currentSemester > 10
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Semestre no válido",
                text: "El semestre actual debe estar entre 1 y 10.",
                confirmButtonText: "Corregir",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        if (
            formProfile.admissionYear < 1900 ||
            formProfile.admissionYear > currentYear
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Año de ingreso no válido",
                text:
                    `El año de ingreso debe estar entre 1900 y ${currentYear}.`,
                confirmButtonText: "Corregir",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        if (
            !isValidAcademicAverage(
                formProfile.careerAverage,
            ) ||
            !isValidAcademicAverage(
                formProfile.previousSemesterAverage,
            )
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Promedio no válido",
                text: "Los promedios deben estar entre 0 y 5. También puedes dejar estos campos vacíos.",
                confirmButtonText: "Corregir",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        if (
            formProfile.freeTuition.isBeneficiary &&
            formProfile.freeTuition.period.trim() === ""
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Falta el periodo",
                text: "Ingresa el periodo correspondiente a la política de gratuidad.",
                confirmButtonText: "Corregir",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        const updatedProfile: StudentProfile = {
            ...formProfile,

            isConfigured: true,

            fullName,

            university:
                studentProfile.university,

            program:
                studentProfile.program,

            studentCode,

            curriculumId:
                formProfile.curriculumId.trim(),

            careerAverage:
                formProfile.careerAverage.trim(),

            previousSemesterAverage:
                formProfile.previousSemesterAverage.trim(),

            freeTuition: {
                ...formProfile.freeTuition,

                period:
                    formProfile.freeTuition.period.trim(),
            },

            personalInformation: {
                identificationType:
                    formProfile.personalInformation
                        .identificationType.trim(),

                identificationNumber:
                    formProfile.personalInformation
                        .identificationNumber.trim(),

                documentIssueCity:
                    formProfile.personalInformation
                        .documentIssueCity.trim(),

                birthDate:
                    formProfile.personalInformation
                        .birthDate,

                institutionalUser:
                    formProfile.personalInformation
                        .institutionalUser.trim(),
            },
        };

        await onSaveProfile(updatedProfile);

        setFormProfile(
            copyStudentProfile(updatedProfile),
        );

        setIsEditing(false);

        await Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "Información guardada",
            text: "El perfil académico fue actualizado.",
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true,
        });
    };

    return (
        <main className="home-page">
            <section className="home-page__welcome">
                <div className="home-page__welcome-copy">
                    <p className="home-page__eyebrow">
                        Información del estudiante
                    </p>

                    <h1>
                        {studentProfile.isConfigured
                            ? `Hola, ${studentProfile.fullName}`
                            : "Configura tu perfil académico"}
                    </h1>

                    <p>
                        {studentProfile.isConfigured
                            ? "Consulta y actualiza la información general asociada a tu proceso académico."
                            : "Completa tus datos principales para personalizar el pensum interactivo en este dispositivo."}
                    </p>
                </div>

                {studentProfile.isConfigured &&
                    !isEditing && (
                        <button
                            className="home-page__edit-button"
                            type="button"
                            onClick={() => setIsEditing(true)}
                        >
                            <LuPencil aria-hidden="true" />
                            Editar información
                        </button>
                    )}
            </section>

            {isEditing ? (
                <form
                    className="student-profile-form"
                    onSubmit={handleSubmit}
                >
                    <section className="student-profile-form__section">
                        <div className="student-profile-form__heading">
                            <span aria-hidden="true">
                                <LuGraduationCap />
                            </span>

                            <div>
                                <p>Información principal</p>
                                <h2>Datos académicos</h2>
                            </div>
                        </div>

                        <div className="student-profile-form__grid">
                            <label className="student-profile-field student-profile-field--wide">
                                <span>Nombre completo *</span>

                                <input
                                    type="text"
                                    value={formProfile.fullName}
                                    placeholder="Escribe tu nombre completo"
                                    autoComplete="name"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                fullName:
                                                    event.target.value,
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field student-profile-field--locked">
                                <span>Universidad</span>

                                <input
                                    type="text"
                                    value={formProfile.university}
                                    readOnly
                                    aria-readonly="true"
                                />

                                <small>
                                    Este valor pertenece al pensum y no puede modificarse.
                                </small>
                            </label>

                            <label className="student-profile-field student-profile-field--locked">
                                <span>Programa académico</span>

                                <input
                                    type="text"
                                    value={formProfile.program}
                                    readOnly
                                    aria-readonly="true"
                                />

                                <small>
                                    Esta aplicación corresponde exclusivamente a este programa.
                                </small>
                            </label>

                            <label className="student-profile-field">
                                <span>Código estudiantil *</span>

                                <input
                                    type="text"
                                    value={formProfile.studentCode}
                                    placeholder="Código asignado por la universidad"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                studentCode:
                                                    event.target.value,
                                            }),
                                        )
                                    }
                                />
                            </label>


                            <label className="student-profile-field">
                                <span>Semestre actual *</span>

                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={
                                        formProfile.currentSemester ??
                                        ""
                                    }
                                    placeholder="1 a 10"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                currentSemester:
                                                    parseOptionalNumber(
                                                        event.target.value,
                                                    ),
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>Año de ingreso *</span>

                                <input
                                    type="number"
                                    min="1900"
                                    max={currentYear}
                                    value={
                                        formProfile.admissionYear ??
                                        ""
                                    }
                                    placeholder={`Ejemplo: ${currentYear - 3}`}
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                admissionYear:
                                                    parseOptionalNumber(
                                                        event.target.value,
                                                    ),
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>Periodo de ingreso *</span>

                                <select
                                    value={
                                        formProfile.admissionPeriod
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                admissionPeriod:
                                                    event.target
                                                        .value as StudentAdmissionPeriod,
                                            }),
                                        )
                                    }
                                >
                                    <option value="">
                                        Selecciona un periodo
                                    </option>

                                    <option value="1">
                                        Primer periodo
                                    </option>

                                    <option value="2">
                                        Segundo periodo
                                    </option>
                                </select>
                            </label>

                            <label className="student-profile-field">
                                <span>Estado académico</span>

                                <select
                                    value={
                                        formProfile.academicStatus
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                academicStatus:
                                                    event.target
                                                        .value as StudentAcademicStatus,
                                            }),
                                        )
                                    }
                                >
                                    <option value="active">
                                        Activo
                                    </option>

                                    <option value="inactive">
                                        Inactivo
                                    </option>

                                    <option value="suspended">
                                        Suspendido
                                    </option>

                                    <option value="graduated">
                                        Graduado
                                    </option>

                                    <option value="other">
                                        Otro
                                    </option>
                                </select>
                            </label>

                            <label className="student-profile-field">
                                <span>Promedio de carrera</span>

                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.01"
                                    value={
                                        formProfile.careerAverage
                                    }
                                    placeholder="Formato: 0.00"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                careerAverage:
                                                    event.target.value,
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>
                                    Promedio del semestre anterior
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.01"
                                    value={
                                        formProfile
                                            .previousSemesterAverage
                                    }
                                    placeholder="Formato: 0.00"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                previousSemesterAverage:
                                                    event.target.value,
                                            }),
                                        )
                                    }
                                />
                            </label>
                        </div>
                    </section>

                    <section className="student-profile-form__section">
                        <div className="student-profile-form__heading">
                            <span aria-hidden="true">
                                <LuGraduationCap />
                            </span>

                            <div>
                                <p>Apoyo institucional</p>
                                <h2>Política de gratuidad</h2>
                            </div>
                        </div>

                        <label className="student-profile-switch">
                            <input
                                type="checkbox"
                                checked={
                                    formProfile.freeTuition
                                        .isBeneficiary
                                }
                                onChange={(event) =>
                                    setFormProfile(
                                        (currentProfile) => ({
                                            ...currentProfile,

                                            freeTuition: {
                                                ...currentProfile
                                                    .freeTuition,

                                                isBeneficiary:
                                                    event.target.checked,
                                            },
                                        }),
                                    )
                                }
                            />

                            <span className="student-profile-switch__control" />

                            <span className="student-profile-switch__copy">
                                <strong>
                                    Soy beneficiario de la política de gratuidad
                                </strong>

                                <small>
                                    Activa esta opción para registrar los periodos financiados.
                                </small>
                            </span>
                        </label>

                        {formProfile.freeTuition
                            .isBeneficiary && (
                                <div className="student-profile-form__grid student-profile-form__grid--tuition">
                                    <label className="student-profile-field">
                                        <span>Periodo *</span>

                                        <input
                                            type="text"
                                            value={
                                                formProfile.freeTuition
                                                    .period
                                            }
                                            placeholder="Ejemplo: 2026.1"
                                            onChange={(event) =>
                                                setFormProfile(
                                                    (currentProfile) => ({
                                                        ...currentProfile,

                                                        freeTuition: {
                                                            ...currentProfile
                                                                .freeTuition,

                                                            period:
                                                                event.target.value,
                                                        },
                                                    }),
                                                )
                                            }
                                        />
                                    </label>

                                    <label className="student-profile-field">
                                        <span>Periodos aprobados</span>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                formProfile.freeTuition
                                                    .approvedPeriods ?? ""
                                            }
                                            onChange={(event) =>
                                                setFormProfile(
                                                    (currentProfile) => ({
                                                        ...currentProfile,

                                                        freeTuition: {
                                                            ...currentProfile
                                                                .freeTuition,

                                                            approvedPeriods:
                                                                parseOptionalNumber(
                                                                    event.target.value,
                                                                ),
                                                        },
                                                    }),
                                                )
                                            }
                                        />
                                    </label>

                                    <label className="student-profile-field">
                                        <span>Periodos financiados</span>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                formProfile.freeTuition
                                                    .fundedPeriods ?? ""
                                            }
                                            onChange={(event) =>
                                                setFormProfile(
                                                    (currentProfile) => ({
                                                        ...currentProfile,

                                                        freeTuition: {
                                                            ...currentProfile
                                                                .freeTuition,

                                                            fundedPeriods:
                                                                parseOptionalNumber(
                                                                    event.target.value,
                                                                ),
                                                        },
                                                    }),
                                                )
                                            }
                                        />
                                    </label>

                                    <label className="student-profile-field">
                                        <span>
                                            Periodos por financiar
                                        </span>

                                        <input
                                            type="number"
                                            min="0"
                                            value={
                                                formProfile.freeTuition
                                                    .remainingPeriods ?? ""
                                            }
                                            onChange={(event) =>
                                                setFormProfile(
                                                    (currentProfile) => ({
                                                        ...currentProfile,

                                                        freeTuition: {
                                                            ...currentProfile
                                                                .freeTuition,

                                                            remainingPeriods:
                                                                parseOptionalNumber(
                                                                    event.target.value,
                                                                ),
                                                        },
                                                    }),
                                                )
                                            }
                                        />
                                    </label>
                                </div>
                            )}
                    </section>

                    <details className="student-profile-form__optional">
                        <summary>
                            Información personal opcional
                        </summary>

                        <p>
                            Estos datos se guardan únicamente en el
                            almacenamiento local del navegador. No están
                            cifrados y no son necesarios para utilizar el
                            pensum.
                        </p>

                        <div className="student-profile-form__grid">
                            <label className="student-profile-field">
                                <span>Tipo de identificación</span>

                                <input
                                    type="text"
                                    value={
                                        formProfile
                                            .personalInformation
                                            .identificationType
                                    }
                                    placeholder="Ejemplo: Cédula de ciudadanía"
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                personalInformation: {
                                                    ...currentProfile
                                                        .personalInformation,

                                                    identificationType:
                                                        event.target.value,
                                                },
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>Número de identificación</span>

                                <input
                                    type="text"
                                    value={
                                        formProfile
                                            .personalInformation
                                            .identificationNumber
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                personalInformation: {
                                                    ...currentProfile
                                                        .personalInformation,

                                                    identificationNumber:
                                                        event.target.value,
                                                },
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>
                                    Municipio de expedición
                                </span>

                                <input
                                    type="text"
                                    value={
                                        formProfile
                                            .personalInformation
                                            .documentIssueCity
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                personalInformation: {
                                                    ...currentProfile
                                                        .personalInformation,

                                                    documentIssueCity:
                                                        event.target.value,
                                                },
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>Fecha de nacimiento</span>

                                <input
                                    type="date"
                                    value={
                                        formProfile
                                            .personalInformation
                                            .birthDate
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                personalInformation: {
                                                    ...currentProfile
                                                        .personalInformation,

                                                    birthDate:
                                                        event.target.value,
                                                },
                                            }),
                                        )
                                    }
                                />
                            </label>

                            <label className="student-profile-field">
                                <span>Usuario institucional</span>

                                <input
                                    type="text"
                                    value={
                                        formProfile
                                            .personalInformation
                                            .institutionalUser
                                    }
                                    onChange={(event) =>
                                        setFormProfile(
                                            (currentProfile) => ({
                                                ...currentProfile,

                                                personalInformation: {
                                                    ...currentProfile
                                                        .personalInformation,

                                                    institutionalUser:
                                                        event.target.value,
                                                },
                                            }),
                                        )
                                    }
                                />
                            </label>
                        </div>
                    </details>

                    <div className="student-profile-form__actions">
                        {studentProfile.isConfigured && (
                            <button
                                className="student-profile-form__cancel"
                                type="button"
                                onClick={handleCancelEditing}
                            >
                                <LuX aria-hidden="true" />
                                Cancelar
                            </button>
                        )}

                        <button
                            className="student-profile-form__save"
                            type="submit"
                        >
                            <LuSave aria-hidden="true" />

                            {studentProfile.isConfigured
                                ? "Guardar cambios"
                                : "Guardar perfil"}
                        </button>
                    </div>
                </form>
            ) : (
                <section
                    className="student-profile-overview"
                    aria-label="Información académica del estudiante"
                >
                    <article className="student-profile-card student-profile-card--main">
                        <p className="student-profile-card__eyebrow">
                            Información académica
                        </p>

                        <h2>{studentProfile.fullName}</h2>

                        <dl className="student-profile-details">
                            <div>
                                <dt>Universidad</dt>
                                <dd>{studentProfile.university}</dd>
                            </div>

                            <div>
                                <dt>Programa</dt>
                                <dd>{studentProfile.program}</dd>
                            </div>

                            <div>
                                <dt>Código estudiantil</dt>
                                <dd>{studentProfile.studentCode}</dd>
                            </div>

                            <div>
                                <dt>Semestre actual</dt>
                                <dd>
                                    {studentProfile.currentSemester ??
                                        "No registrado"}
                                </dd>
                            </div>

                            <div>
                                <dt>Año de ingreso</dt>

                                <dd>
                                    {studentProfile.admissionYear ??
                                        "No registrado"}
                                </dd>
                            </div>

                            <div>
                                <dt>Periodo de ingreso</dt>

                                <dd>
                                    {studentProfile.admissionPeriod
                                        ? `Periodo ${studentProfile.admissionPeriod}`
                                        : "No registrado"}
                                </dd>
                            </div> 

                            <div>
                                <dt>Estado</dt>
                                <dd>
                                    {
                                        academicStatusLabels[
                                        studentProfile
                                            .academicStatus
                                        ]
                                    }
                                </dd>
                            </div>
                        </dl>
                    </article>

                    <article className="student-profile-card">
                        <p className="student-profile-card__eyebrow">
                            Rendimiento
                        </p>

                        <div className="student-profile-average">
                            <div>
                                <span>Promedio de carrera</span>

                                <strong>
                                    {studentProfile.careerAverage ||
                                        "—"}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Promedio del semestre anterior
                                </span>

                                <strong>
                                    {studentProfile
                                        .previousSemesterAverage ||
                                        "—"}
                                </strong>
                            </div>
                        </div>
                    </article>

                    <article className="student-profile-card">
                        <p className="student-profile-card__eyebrow">
                            Política de gratuidad
                        </p>

                        {studentProfile.freeTuition
                            .isBeneficiary ? (
                            <dl className="student-profile-details">
                                <div>
                                    <dt>Estado</dt>
                                    <dd>Beneficiario</dd>
                                </div>

                                <div>
                                    <dt>Periodo</dt>
                                    <dd>
                                        {studentProfile.freeTuition
                                            .period || "No registrado"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>Periodos aprobados</dt>
                                    <dd>
                                        {studentProfile.freeTuition
                                            .approvedPeriods ?? "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>Periodos financiados</dt>
                                    <dd>
                                        {studentProfile.freeTuition
                                            .fundedPeriods ?? "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>Periodos por financiar</dt>
                                    <dd>
                                        {studentProfile.freeTuition
                                            .remainingPeriods ?? "—"}
                                    </dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="student-profile-card__empty">
                                No se registró como beneficiario.
                            </p>
                        )}
                    </article>
                </section>
            )}
        </main>
    );
}

export default HomePage;