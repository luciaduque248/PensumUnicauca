const Alexa = require("ask-sdk-core");
const https = require("https");

const SKILL_NAME = "Mi pensum";
const BASE_URL = "https://pensum-unicauca.vercel.app";

const ENDPOINTS = {
    account: `${BASE_URL}/api/alexa-account`,
    progress: `${BASE_URL}/api/alexa-progress`,
    schedule: `${BASE_URL}/api/alexa-schedule`,
    grades: `${BASE_URL}/api/alexa-grades`,
    academicStatus: `${BASE_URL}/api/alexa-academic-status`,
};

const CUT_LABELS = {
    first: "primer corte",
    second: "segundo corte",
    third: "tercer corte",
};

const getIntentName = (handlerInput) =>
    Alexa.getIntentName(handlerInput.requestEnvelope);

const getAccessToken = (handlerInput) =>
    handlerInput.requestEnvelope.context?.System?.user?.accessToken ?? null;

const buildLinkAccountResponse = (handlerInput) => {
    const speechText =
        "Para consultar tu información académica, debes vincular tu cuenta de Mi pensum desde la aplicación Alexa.";

    return handlerInput.responseBuilder
        .speak(speechText)
        .withLinkAccountCard()
        .withShouldEndSession(true)
        .getResponse();
};

const requestJson = (
    accessToken,
    endpointUrl,
    {
        method = "GET",
        query = {},
        body = null,
    } = {},
) =>
    new Promise((resolve, reject) => {
        const endpoint = new URL(endpointUrl);

        Object.entries(query).forEach(([key, value]) => {
            if (value !== null && value !== undefined && String(value).trim() !== "") {
                endpoint.searchParams.set(key, String(value).trim());
            }
        });

        const requestBody = body === null ? null : JSON.stringify(body);

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        };

        if (requestBody !== null) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(requestBody);
        }

        const request = https.request(
            {
                protocol: endpoint.protocol,
                hostname: endpoint.hostname,
                port: endpoint.port || 443,
                path: `${endpoint.pathname}${endpoint.search}`,
                method,
                headers,
            },
            (response) => {
                let responseBody = "";

                response.setEncoding("utf8");

                response.on("data", (chunk) => {
                    responseBody += chunk;

                    if (responseBody.length > 1_000_000) {
                        request.destroy(
                            new Error("La respuesta del servicio es demasiado grande."),
                        );
                    }
                });

                response.on("end", () => {
                    let payload;

                    try {
                        payload = responseBody === "" ? {} : JSON.parse(responseBody);
                    } catch {
                        reject(
                            new Error("Mi pensum devolvió una respuesta JSON inválida."),
                        );
                        return;
                    }

                    const statusCode = response.statusCode ?? 500;

                    if (statusCode >= 200 && statusCode < 300) {
                        resolve(payload);
                        return;
                    }

                    const error = new Error(
                        typeof payload?.error === "string"
                            ? payload.error
                            : "No fue posible completar la consulta.",
                    );

                    error.statusCode = statusCode;
                    error.code =
                        typeof payload?.code === "string" ? payload.code : null;
                    error.payload = payload;

                    reject(error);
                });
            },
        );

        request.setTimeout(8000, () => {
            request.destroy(
                new Error("La consulta a Mi pensum tardó demasiado."),
            );
        });

        request.on("error", reject);

        if (requestBody !== null) {
            request.write(requestBody);
        }

        request.end();
    });

const requestWithAccount = async (
    handlerInput,
    requestFunction,
) => {
    const accessToken = getAccessToken(handlerInput);

    if (!accessToken) {
        return {
            kind: "link-required",
            response: buildLinkAccountResponse(handlerInput),
        };
    }

    try {
        const result = await requestFunction(accessToken);

        return {
            kind: "ok",
            accessToken,
            result,
        };
    } catch (error) {
        if (error?.statusCode === 401) {
            return {
                kind: "link-required",
                response: buildLinkAccountResponse(handlerInput),
            };
        }

        throw error;
    }
};

const getResolvedSlot = (handlerInput, slotName) => {
    const slot = Alexa.getSlot(handlerInput.requestEnvelope, slotName);
    const rawValue = slot?.value?.trim() ?? "";
    const authorities = slot?.resolutions?.resolutionsPerAuthority ?? [];

    for (const authority of authorities) {
        if (authority?.status?.code !== "ER_SUCCESS_MATCH") {
            continue;
        }

        const resolvedValue = authority.values?.[0]?.value;

        if (resolvedValue) {
            return {
                rawValue,
                value: resolvedValue.name ?? rawValue,
                id: resolvedValue.id ?? null,
            };
        }
    }

    return {
        rawValue,
        value: rawValue,
        id: null,
    };
};

const normalizeCutId = (value) => {
    const normalized = String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    if (
        [
            "first",
            "1",
            "uno",
            "primer",
            "primero",
            "primer corte",
            "corte uno",
            "corte 1",
        ].includes(normalized)
    ) {
        return "first";
    }

    if (
        [
            "second",
            "2",
            "dos",
            "segundo",
            "segundo corte",
            "corte dos",
            "corte 2",
        ].includes(normalized)
    ) {
        return "second";
    }

    if (
        [
            "third",
            "3",
            "tres",
            "tercer",
            "tercero",
            "tercer corte",
            "corte tres",
            "corte 3",
            "final",
        ].includes(normalized)
    ) {
        return "third";
    }

    return null;
};

const parseGrade = (value) => {
    const normalized = String(value ?? "").replace(",", ".").trim();

    if (normalized === "") {
        return null;
    }

    const grade = Number(normalized);

    if (!Number.isFinite(grade) || grade < 0 || grade > 5) {
        return null;
    }

    return Math.round((grade + Number.EPSILON) * 10) / 10;
};

const formatSubjectNames = (names) => {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} y ${names[1]}`;

    return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

const formatSpokenTime = (time) => {
    const [hourText, minuteText = "00"] = String(time).split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
        return String(time);
    }

    const displayHour = hour % 12 || 12;
    const period =
        hour < 6
            ? "de la madrugada"
            : hour < 12
                ? "de la mañana"
                : hour < 19
                    ? "de la tarde"
                    : "de la noche";

    if (minute === 0) return `${displayHour} ${period}`;
    if (minute === 15) return `${displayHour} y cuarto ${period}`;
    if (minute === 30) return `${displayHour} y media ${period}`;

    return `${displayHour} y ${minute} ${period}`;
};

const formatGrade = (grade, decimals = 1) =>
    Number(grade).toFixed(decimals).replace(".", " coma ");

const buildServiceErrorResponse = (
    handlerInput,
    consultation,
) =>
    handlerInput.responseBuilder
        .speak(
            `No pude consultar ${consultation} en este momento. Inténtalo nuevamente dentro de unos minutos.`,
        )
        .reprompt(`Puedes volver a preguntarme por ${consultation}.`)
        .getResponse();

const getRequestedSubject = (handlerInput) => {
    const slot = getResolvedSlot(handlerInput, "Materia");
    return (slot.value || slot.rawValue).trim();
};

const getSubjectDetail = async (accessToken, subject) => {
    const result = await requestJson(accessToken, ENDPOINTS.grades, {
        query: { subject },
    });

    const matches = result?.requestedSubject?.matches ?? [];

    return {
        result,
        matches: Array.isArray(matches) ? matches : [],
    };
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
    },

    async handle(handlerInput) {
        try {
            const verification = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.account),
            );

            if (verification.kind !== "ok") {
                return verification.response;
            }

            const snapshotExists = verification.result?.snapshot?.exists === true;
            const speechText = snapshotExists
                ? "Bienvenida a Mi pensum. Tu cuenta está vinculada y tus datos académicos están disponibles. Puedes preguntarme por tu progreso, créditos, materias, horario, notas, promedio o situación académica."
                : "Bienvenida a Mi pensum. Tu cuenta está vinculada, pero todavía no encuentro información académica sincronizada. Abre la aplicación web y realiza un cambio para guardar tus datos.";

            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt("¿Qué información académica deseas consultar?")
                .withSimpleCard(SKILL_NAME, speechText)
                .getResponse();
        } catch (error) {
            console.error("LaunchRequest:", error);
            return buildServiceErrorResponse(handlerInput, "tu cuenta académica");
        }
    },
};

const GetProgressIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetProgressIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.progress),
            );

            if (response.kind !== "ok") return response.response;

            const progress = response.result?.progress;

            if (response.result?.snapshotExists !== true || !progress) {
                return handlerInput.responseBuilder
                    .speak(
                        "Tu cuenta está vinculada, pero todavía no encuentro información académica sincronizada.",
                    )
                    .getResponse();
            }

            const speechText =
                `Tu progreso académico es del ${progress.percentage} por ciento. ` +
                `Has aprobado ${progress.approvedSubjects} de ${progress.totalSubjects} materias, ` +
                `con ${progress.approvedCredits} de ${progress.totalCredits} créditos aprobados. ` +
                `Actualmente tienes ${progress.inProgressSubjects} materias en curso y ` +
                `${progress.pendingSubjects} pendientes. Te faltan ${progress.remainingCredits} créditos.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(
                    "Puedes preguntarme también por tus créditos, materias, horario, notas o situación académica.",
                )
                .withSimpleCard(`${SKILL_NAME} - Progreso`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetProgressIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tu progreso académico");
        }
    },
};

const GetApprovedCreditsIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetApprovedCreditsIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.progress),
            );

            if (response.kind !== "ok") return response.response;

            const progress = response.result?.progress;

            if (response.result?.snapshotExists !== true || !progress) {
                return handlerInput.responseBuilder
                    .speak("Todavía no encuentro información académica sincronizada.")
                    .getResponse();
            }

            const speechText =
                `Tienes ${progress.approvedCredits} de ${progress.totalCredits} créditos aprobados. ` +
                `Te faltan ${progress.remainingCredits} créditos por aprobar y llevas el ${progress.percentage} por ciento del plan.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Créditos`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetApprovedCreditsIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tus créditos");
        }
    },
};

const GetCurrentSubjectsIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetCurrentSubjectsIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.progress),
            );

            if (response.kind !== "ok") return response.response;

            const progress = response.result?.progress;
            const subjects = Array.isArray(progress?.inProgressSubjectDetails)
                ? progress.inProgressSubjectDetails
                : [];

            if (subjects.length === 0) {
                return handlerInput.responseBuilder
                    .speak("Actualmente no tienes materias registradas como en curso.")
                    .getResponse();
            }

            const spokenSubjects = subjects.slice(0, 5);
            let speechText =
                `Actualmente tienes ${subjects.length} materias en curso: ` +
                `${formatSubjectNames(spokenSubjects.map((subject) => subject.name))}.`;

            if (subjects.length > spokenSubjects.length) {
                speechText += ` También tienes ${subjects.length - spokenSubjects.length} materias más registradas.`;
            }

            const totalCredits = subjects.reduce(
                (total, subject) => total + Number(subject.credits || 0),
                0,
            );

            speechText += ` En total representan ${totalCredits} créditos.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(
                    `${SKILL_NAME} - Materias en curso`,
                    subjects
                        .map(
                            (subject, index) =>
                                `${index + 1}. ${subject.name} (${subject.code}) — ${subject.credits} créditos`,
                        )
                        .join("\n"),
                )
                .getResponse();
        } catch (error) {
            console.error("GetCurrentSubjectsIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tus materias en curso");
        }
    },
};

const GetScheduleIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetScheduleIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.schedule),
            );

            if (response.kind !== "ok") return response.response;

            if (response.result?.scheduleExists !== true) {
                return handlerInput.responseBuilder
                    .speak(
                        "Todavía no tienes un horario académico guardado. Puedes agregar tus clases desde la sección Horario de Mi pensum.",
                    )
                    .getResponse();
            }

            const today = response.result?.schedule?.today;
            const classes = Array.isArray(today?.classes) ? today.classes : [];

            if (classes.length === 0) {
                return handlerInput.responseBuilder
                    .speak(`No tienes clases registradas para ${today?.dayLabel ?? "hoy"}.`)
                    .getResponse();
            }

            const descriptions = classes.map(
                (scheduleClass) =>
                    `${scheduleClass.subjectName}, de ${formatSpokenTime(scheduleClass.startTime)} a ${formatSpokenTime(scheduleClass.endTime)}`,
            );

            const speechText =
                `Hoy tienes ${classes.length} ${classes.length === 1 ? "clase" : "clases"}: ` +
                `${formatSubjectNames(descriptions)}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Horario`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetScheduleIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tu horario");
        }
    },
};

const GetNextClassIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetNextClassIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.schedule),
            );

            if (response.kind !== "ok") return response.response;

            const schedule = response.result?.schedule;

            if (response.result?.scheduleExists !== true || !schedule) {
                return handlerInput.responseBuilder
                    .speak("Todavía no tienes un horario académico guardado.")
                    .getResponse();
            }

            if (schedule.currentClass) {
                const current = schedule.currentClass;
                return handlerInput.responseBuilder
                    .speak(
                        `Ahora tienes ${current.subjectName}, hasta las ${formatSpokenTime(current.endTime)}.`,
                    )
                    .getResponse();
            }

            const next = schedule.nextClass;

            if (!next) {
                return handlerInput.responseBuilder
                    .speak("No encuentro una próxima clase registrada en tu horario.")
                    .getResponse();
            }

            const relativeDay =
                next.daysUntil === 0
                    ? "hoy"
                    : next.daysUntil === 1
                        ? "mañana"
                        : `el ${next.dayLabel}`;

            const speechText =
                `Tu próxima clase es ${next.subjectName}, ${relativeDay}, ` +
                `a las ${formatSpokenTime(next.startTime)}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Próxima clase`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetNextClassIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tu próxima clase");
        }
    },
};

const GetSemesterAverageIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetSemesterAverageIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.grades),
            );

            if (response.kind !== "ok") return response.response;

            const grades = response.result?.grades;

            if (!grades || grades.enrolledSubjects === 0) {
                return handlerInput.responseBuilder
                    .speak("No encuentro materias matriculadas para calcular el promedio.")
                    .getResponse();
            }

            if (typeof grades.semesterAverage !== "number") {
                return handlerInput.responseBuilder
                    .speak(
                        "Todavía no puedo calcular tu promedio del semestre porque ninguna materia tiene los tres cortes completos.",
                    )
                    .getResponse();
            }

            const speechText =
                `Tu promedio del semestre es ${formatGrade(grades.semesterAverage)}. ` +
                `Se calcula con ${grades.completedSubjects} materias completas y ${grades.completedCredits} créditos.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Promedio`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetSemesterAverageIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tu promedio del semestre");
        }
    },
};

const GetSubjectsByGradeIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetSubjectsByGradeIntent"
        );
    },

    async handle(handlerInput) {
        const minimumSlot = getResolvedSlot(handlerInput, "NotaMinima");
        const minimumGrade = parseGrade(minimumSlot.value || minimumSlot.rawValue) ?? 3;

        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.grades),
            );

            if (response.kind !== "ok") return response.response;

            const details = Array.isArray(response.result?.grades?.completedSubjectDetails)
                ? response.result.grades.completedSubjectDetails
                : [];

            const matches = details.filter(
                (subject) =>
                    typeof subject.officialGrade === "number" &&
                    subject.officialGrade >= minimumGrade,
            );

            if (matches.length === 0) {
                return handlerInput.responseBuilder
                    .speak(
                        `No encuentro materias completas con nota ${formatGrade(minimumGrade)} o superior.`,
                    )
                    .getResponse();
            }

            const spoken = matches.slice(0, 5);
            const speechText =
                `Tienes ${matches.length} ${matches.length === 1 ? "materia" : "materias"} ` +
                `con nota ${formatGrade(minimumGrade)} o superior: ` +
                `${formatSubjectNames(spoken.map((subject) => `${subject.name}, ${formatGrade(subject.officialGrade)}`))}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(
                    `${SKILL_NAME} - Materias por nota`,
                    matches
                        .map(
                            (subject) =>
                                `${subject.name}: ${Number(subject.officialGrade).toFixed(1)}`,
                        )
                        .join("\n"),
                )
                .getResponse();
        } catch (error) {
            console.error("GetSubjectsByGradeIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tus materias por nota");
        }
    },
};

const GetSubjectGradesIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetSubjectGradesIntent"
        );
    },

    async handle(handlerInput) {
        const subject = getRequestedSubject(handlerInput);

        if (!subject) {
            return handlerInput.responseBuilder
                .speak("¿De qué materia quieres consultar las notas?")
                .reprompt("Dime el nombre de la materia.")
                .addElicitSlotDirective("Materia")
                .getResponse();
        }

        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => getSubjectDetail(accessToken, subject),
            );

            if (response.kind !== "ok") return response.response;

            const matches = response.result.matches;

            if (matches.length === 0) {
                return handlerInput.responseBuilder
                    .speak("No encontré esa materia entre tus materias matriculadas. Dime nuevamente el nombre.")
                    .reprompt("¿De qué materia quieres consultar las notas?")
                    .addElicitSlotDirective("Materia")
                    .getResponse();
            }

            const detail = matches[0];
            const cutPhrases = Object.values(detail.cuts ?? {})
                .filter((cut) => typeof cut?.grade === "number")
                .map((cut) => `${cut.label}: ${formatGrade(cut.grade, 2)}`);

            let speechText = cutPhrases.length > 0
                ? `${detail.name}. ${cutPhrases.join(". ")}.`
                : `Todavía no tienes notas registradas en ${detail.name}.`;

            if (typeof detail.accumulatedGrade === "number") {
                speechText += ` Acumulado: ${formatGrade(detail.accumulatedGrade, 2)}.`;
            }

            if (typeof detail.officialGrade === "number") {
                speechText += ` Definitiva aproximada: ${formatGrade(detail.officialGrade)}.`;
            }

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - ${detail.name}`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetSubjectGradesIntent:", error);
            return buildServiceErrorResponse(handlerInput, "las notas de esa materia");
        }
    },
};

const GetSubjectCutGradeIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetSubjectCutGradeIntent"
        );
    },

    async handle(handlerInput) {
        const subject = getRequestedSubject(handlerInput);
        const cutSlot = getResolvedSlot(handlerInput, "Corte");
        const cutId = normalizeCutId(cutSlot.id || cutSlot.value || cutSlot.rawValue);

        if (!subject) {
            return handlerInput.responseBuilder
                .speak("¿De qué materia quieres consultar el corte?")
                .addElicitSlotDirective("Materia")
                .getResponse();
        }

        if (!cutId) {
            return handlerInput.responseBuilder
                .speak("¿Qué corte quieres consultar: primero, segundo o tercero?")
                .addElicitSlotDirective("Corte")
                .getResponse();
        }

        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => getSubjectDetail(accessToken, subject),
            );

            if (response.kind !== "ok") return response.response;

            const detail = response.result.matches[0];

            if (!detail) {
                return handlerInput.responseBuilder
                    .speak("No encontré esa materia entre tus materias matriculadas.")
                    .getResponse();
            }

            const cut = detail.cuts?.[cutId];

            if (!cut || typeof cut.grade !== "number") {
                return handlerInput.responseBuilder
                    .speak(`Todavía no tienes una nota calculable en el ${CUT_LABELS[cutId]} de ${detail.name}.`)
                    .getResponse();
            }

            const speechText =
                `En el ${CUT_LABELS[cutId]} de ${detail.name} llevas ${formatGrade(cut.grade, 2)}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - ${detail.name}`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetSubjectCutGradeIntent:", error);
            return buildServiceErrorResponse(handlerInput, "la nota de ese corte");
        }
    },
};

const GetSubjectAccumulatedIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetSubjectAccumulatedIntent"
        );
    },

    async handle(handlerInput) {
        const subject = getRequestedSubject(handlerInput);

        if (!subject) {
            return handlerInput.responseBuilder
                .speak("¿De qué materia quieres consultar el acumulado?")
                .addElicitSlotDirective("Materia")
                .getResponse();
        }

        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => getSubjectDetail(accessToken, subject),
            );

            if (response.kind !== "ok") return response.response;

            const detail = response.result.matches[0];

            if (!detail) {
                return handlerInput.responseBuilder
                    .speak("No encontré esa materia entre tus materias matriculadas.")
                    .getResponse();
            }

            if (typeof detail.accumulatedGrade !== "number") {
                return handlerInput.responseBuilder
                    .speak(`Todavía no puedo calcular el acumulado de ${detail.name}.`)
                    .getResponse();
            }

            const speechText =
                `El acumulado de ${detail.name} es ${formatGrade(detail.accumulatedGrade, 2)}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Acumulado`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetSubjectAccumulatedIntent:", error);
            return buildServiceErrorResponse(handlerInput, "el acumulado de esa materia");
        }
    },
};

const RegisterSubjectGradeIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "RegisterSubjectGradeIntent"
        );
    },

    async handle(handlerInput) {
        const subject = getRequestedSubject(handlerInput);
        const cutSlot = getResolvedSlot(handlerInput, "Corte");
        const cutId = normalizeCutId(cutSlot.id || cutSlot.value || cutSlot.rawValue);
        const gradeSlot = getResolvedSlot(handlerInput, "Nota");
        const grade = parseGrade(gradeSlot.value || gradeSlot.rawValue);
        const activitySlot = getResolvedSlot(handlerInput, "Actividad");
        const activity = (activitySlot.value || activitySlot.rawValue).trim();

        if (!subject) {
            return handlerInput.responseBuilder
                .speak("¿En qué materia quieres registrar la nota?")
                .addElicitSlotDirective("Materia")
                .getResponse();
        }

        if (!cutId) {
            return handlerInput.responseBuilder
                .speak("¿En qué corte quieres registrar la nota?")
                .addElicitSlotDirective("Corte")
                .getResponse();
        }

        if (grade === null) {
            return handlerInput.responseBuilder
                .speak("¿Qué nota quieres registrar? Debe estar entre cero y cinco.")
                .addElicitSlotDirective("Nota")
                .getResponse();
        }

        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) =>
                    requestJson(accessToken, ENDPOINTS.grades, {
                        method: "POST",
                        body: {
                            action: "set-grade",
                            subject,
                            cut: cutId,
                            grade,
                            activity: activity || undefined,
                        },
                    }),
            );

            if (response.kind !== "ok") return response.response;

            const update = response.result?.update;
            const speechText =
                `Registré ${formatGrade(grade)} en ${update?.activity?.name ?? "la actividad"} ` +
                `del ${CUT_LABELS[cutId]} de ${update?.subject?.name ?? subject}.`;

            return handlerInput.responseBuilder
                .speak(speechText)
                .withSimpleCard(`${SKILL_NAME} - Nota registrada`, speechText)
                .getResponse();
        } catch (error) {
            console.error("RegisterSubjectGradeIntent:", error);

            if (error?.statusCode === 401) {
                return buildLinkAccountResponse(handlerInput);
            }

            if (error?.code === "activity_required") {
                const activities = error.payload?.cut?.activities ?? [];
                const names = activities.map((item) => item.name).filter(Boolean);
                const speechText = names.length > 0
                    ? `Ese corte tiene varias actividades: ${formatSubjectNames(names)}. ¿En cuál quieres registrar la nota?`
                    : "Ese corte tiene varias actividades. ¿En cuál quieres registrar la nota?";

                return handlerInput.responseBuilder
                    .speak(speechText)
                    .reprompt("Dime el nombre de la actividad.")
                    .addElicitSlotDirective("Actividad")
                    .getResponse();
            }

            if (error?.code === "activity_not_found") {
                return handlerInput.responseBuilder
                    .speak("No encontré esa actividad en el corte indicado. Dime nuevamente la actividad.")
                    .addElicitSlotDirective("Actividad")
                    .getResponse();
            }

            if (
                error?.code === "subject_not_found" ||
                error?.code === "ambiguous_subject"
            ) {
                return handlerInput.responseBuilder
                    .speak("No pude identificar de forma única esa materia. Dime nuevamente el nombre de la materia.")
                    .addElicitSlotDirective("Materia")
                    .getResponse();
            }

            if (error?.code === "invalid_grade") {
                return handlerInput.responseBuilder
                    .speak("La nota debe estar entre cero y cinco. Dime nuevamente la nota.")
                    .addElicitSlotDirective("Nota")
                    .getResponse();
            }

            return buildServiceErrorResponse(handlerInput, "el registro de la nota");
        }
    },
};

const GetAcademicStatusIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "GetAcademicStatusIntent"
        );
    },

    async handle(handlerInput) {
        try {
            const response = await requestWithAccount(
                handlerInput,
                (accessToken) => requestJson(accessToken, ENDPOINTS.academicStatus),
            );

            if (response.kind !== "ok") return response.response;

            const academicStatus = response.result?.academicStatus;

            if (!academicStatus) {
                return handlerInput.responseBuilder
                    .speak("No encuentro información suficiente para determinar tu situación académica.")
                    .getResponse();
            }

            const restrictions = Array.isArray(academicStatus.activeRestrictions)
                ? academicStatus.activeRestrictions.filter(Boolean)
                : [];

            let speechText =
                `Tu situación académica actual es: ${academicStatus.situationLabel}. ` +
                `${academicStatus.lowPerformance?.registered ? "Tienes antecedente de bajo rendimiento. " : "No tienes bajo rendimiento registrado. "}` +
                `${academicStatus.conditionalEnrollment?.active ? "Tienes matrícula condicional activa. " : "No tienes matrícula condicional activa. "}` +
                `${academicStatus.continuation?.rightToContinue ? "Conservas el derecho a continuar estudios. " : "Está registrado que perdiste el derecho a continuar estudios. "}`;

            if (restrictions.length > 0) {
                speechText += `Restricción actual: ${restrictions[0]}.`;
            } else {
                speechText += "No tienes restricciones académicas activas registradas.";
            }

            return handlerInput.responseBuilder
                .speak(speechText)
                .reprompt(
                    "Puedes preguntarme también por tu progreso, créditos, notas u horario.",
                )
                .withSimpleCard(`${SKILL_NAME} - Situación académica`, speechText)
                .getResponse();
        } catch (error) {
            console.error("GetAcademicStatusIntent:", error);
            return buildServiceErrorResponse(handlerInput, "tu situación académica");
        }
    },
};

const ExitPensumIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "ExitPensumIntent"
        );
    },

    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak("Hasta luego. Cerré Mi pensum.")
            .withShouldEndSession(true)
            .getResponse();
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "AMAZON.HelpIntent"
        );
    },

    handle(handlerInput) {
        const speechText =
            "Puedes preguntarme por tu progreso, créditos, materias en curso, horario, próxima clase, promedio, notas, acumulados o situación académica. También puedes decir registra una nota.";

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt("¿Qué deseas consultar?")
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            ["AMAZON.CancelIntent", "AMAZON.StopIntent", "AMAZON.NavigateHomeIntent"].includes(
                getIntentName(handlerInput),
            )
        );
    },

    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak("Hasta luego.")
            .withShouldEndSession(true)
            .getResponse();
    },
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return (
            Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
            getIntentName(handlerInput) === "AMAZON.FallbackIntent"
        );
    },

    handle(handlerInput) {
        const speechText =
            "No entendí esa consulta. Puedes preguntarme por progreso, créditos, materias, horario, notas, promedio o situación académica.";

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt("¿Qué información académica deseas consultar?")
            .getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
    },

    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },

    handle(handlerInput, error) {
        console.error("Alexa skill error:", error);

        return handlerInput.responseBuilder
            .speak(
                "Ocurrió un problema al procesar tu solicitud. Inténtalo nuevamente.",
            )
            .reprompt("Puedes volver a hacer tu consulta.")
            .getResponse();
    },
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GetProgressIntentHandler,
        GetApprovedCreditsIntentHandler,
        GetCurrentSubjectsIntentHandler,
        GetScheduleIntentHandler,
        GetNextClassIntentHandler,
        GetSemesterAverageIntentHandler,
        GetSubjectsByGradeIntentHandler,
        GetSubjectGradesIntentHandler,
        GetSubjectCutGradeIntentHandler,
        GetSubjectAccumulatedIntentHandler,
        RegisterSubjectGradeIntentHandler,
        GetAcademicStatusIntentHandler,
        ExitPensumIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
