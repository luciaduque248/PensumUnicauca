/* eslint-disable react-hooks/set-state-in-effect */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

import {
    useAuth,
} from "../hooks/useAuth";

import {
    getAcademicSnapshot,
    saveAcademicSnapshot,
} from "../services/academicSyncService";

import {
    ACADEMIC_STORAGE_CHANGED_EVENT,
    clearAccountStorageDirty,
    getAccountStorageDirtyMarker,
    hasAccountInitialSyncLoaded,
    hasAccountStorageDirtyChanges,
    markAccountInitialSyncLoaded,
    readAccountAcademicData,
    replaceAccountAcademicData,
} from "../utils/accountStorage";

import type {
    AcademicStorageChangedDetail,
} from "../types/academicSync";

interface AcademicSyncGateProps {
    children: ReactNode;
}

/*
 * Espera después del último cambio antes
 * de guardar el snapshot en Supabase.
 */
const SAVE_DELAY_MS =
    1500;

/*
 * Verificación de seguridad.
 *
 * Si por alguna razón un evento de cambio no produjo
 * el guardado esperado, se vuelve a intentar mientras
 * exista una marca local pendiente.
 */
const SAFETY_SAVE_INTERVAL_MS =
    10000;

const CLOUD_REVISION_PREFIX =
    "pensum-account-cloud-revision:";

const getCloudRevisionKey = (
    userId: string,
): string => {
    return `${CLOUD_REVISION_PREFIX}${userId}`;
};

const saveCloudRevision = (
    userId: string,
    updatedAt: string,
): void => {
    window.sessionStorage.setItem(
        getCloudRevisionKey(
            userId,
        ),
        updatedAt,
    );
};

const logSyncError = (
    context: string,
    error: unknown,
): void => {
    console.error(
        `[Sincronización académica] ${context}`,
        error,
    );
};

export const AcademicSyncGate = ({
    children,
}: AcademicSyncGateProps) => {
    const {
        user,
    } = useAuth();

    const [
        isReady,
        setIsReady,
    ] =
        useState(
            () =>
                !user ||
                hasAccountInitialSyncLoaded(
                    user.id,
                ),
        );

    /*
     * Serializa los guardados.
     *
     * Si el usuario hace varios cambios seguidos,
     * cada guardado espera al anterior.
     */
    const saveQueueRef =
        useRef<Promise<void>>(
            Promise.resolve(),
        );

    /*
     * Evita interpretar la hidratación inicial
     * desde Supabase como una edición del usuario.
     */
    const isHydratingFromCloudRef =
        useRef(false);

    /*
     * Guarda el snapshot local actual en Supabase.
     *
     * Esta función nunca consulta primero la nube,
     * nunca reemplaza localStorage y nunca recarga
     * la página.
     */
    const queueLocalSave =
        useCallback(
            (
                userId: string,
            ): Promise<void> => {
                const nextSave =
                    saveQueueRef.current
                        .catch(
                            () =>
                                undefined,
                        )
                        .then(
                            async () => {
                                /*
                                 * Puede haberse limpiado la marca
                                 * mientras la tarea esperaba en cola.
                                 */
                                if (
                                    !hasAccountStorageDirtyChanges(
                                        userId,
                                    )
                                ) {
                                    return;
                                }

                                const dirtyMarker =
                                    getAccountStorageDirtyMarker(
                                        userId,
                                    );

                                /*
                                 * Se lee localStorage justo antes
                                 * de guardar para obtener el último
                                 * estado realizado por el estudiante.
                                 */
                                const academicData =
                                    readAccountAcademicData(
                                        userId,
                                    );

                                const updatedAt =
                                    await saveAcademicSnapshot(
                                        userId,
                                        academicData,
                                    );

                                saveCloudRevision(
                                    userId,
                                    updatedAt,
                                );

                                /*
                                 * clearAccountStorageDirty debe limpiar
                                 * solamente la marca que corresponde al
                                 * snapshot recién guardado.
                                 *
                                 * Si el usuario realizó otro cambio mientras
                                 * Supabase respondía, la nueva marca permanece
                                 * y se ejecutará otro guardado.
                                 */
                                clearAccountStorageDirty(
                                    userId,
                                    dirtyMarker,
                                );
                            },
                        );

                saveQueueRef.current =
                    nextSave;

                return nextSave;
            },
            [],
        );

    /*
     * Carga inicial de la cuenta.
     *
     * Supabase solo puede reemplazar localStorage antes de
     * mostrar la aplicación y únicamente cuando no hay una
     * edición local pendiente.
     */
    useEffect(() => {
        if (!user) {
            setIsReady(
                true,
            );

            return;
        }

        const userId =
            user.id;

        /*
         * Durante esta sesión ya se realizó la carga inicial.
         *
         * A partir de aquí localStorage es la fuente principal.
         */
        if (
            hasAccountInitialSyncLoaded(
                userId,
            )
        ) {
            setIsReady(
                true,
            );

            if (
                hasAccountStorageDirtyChanges(
                    userId,
                )
            ) {
                void queueLocalSave(
                    userId,
                ).catch(
                    (
                        error,
                    ) => {
                        logSyncError(
                            "No fue posible guardar los cambios pendientes.",
                            error,
                        );
                    },
                );
            }

            return;
        }

        let isActive =
            true;

        setIsReady(
            false,
        );

        const initializeAccount =
            async (): Promise<void> => {
                try {
                    /*
                     * Si ya hay una modificación local pendiente,
                     * esa información tiene prioridad sobre Supabase.
                     */
                    if (
                        hasAccountStorageDirtyChanges(
                            userId,
                        )
                    ) {
                        await queueLocalSave(
                            userId,
                        );

                        return;
                    }

                    const cloudSnapshot =
                        await getAcademicSnapshot(
                            userId,
                        );

                    if (
                        cloudSnapshot
                    ) {
                        /*
                         * La hidratación ocurre mientras children todavía
                         * no se renderiza. Por eso no se ve un parpadeo.
                         */
                        isHydratingFromCloudRef.current =
                            true;

                        try {
                            replaceAccountAcademicData(
                                userId,
                                cloudSnapshot.academicData,
                            );

                            /*
                             * La escritura de datos provenientes de Supabase
                             * no debe quedar marcada como edición local.
                             */
                            const cloudDirtyMarker =
                                getAccountStorageDirtyMarker(
                                    userId,
                                );

                            clearAccountStorageDirty(
                                userId,
                                cloudDirtyMarker,
                            );

                            saveCloudRevision(
                                userId,
                                cloudSnapshot.updatedAt,
                            );
                        } finally {
                            isHydratingFromCloudRef.current =
                                false;
                        }

                        return;
                    }

                    /*
                     * Si Supabase todavía no tiene snapshot, pero el
                     * navegador sí tiene información, se crea la copia
                     * inicial sin modificar la interfaz.
                     */
                    const localAcademicData =
                        readAccountAcademicData(
                            userId,
                        );

                    if (
                        Object.keys(
                            localAcademicData,
                        ).length >
                        0
                    ) {
                        const updatedAt =
                            await saveAcademicSnapshot(
                                userId,
                                localAcademicData,
                            );

                        saveCloudRevision(
                            userId,
                            updatedAt,
                        );
                    }
                } catch (
                error
                ) {
                    logSyncError(
                        "No fue posible realizar la carga inicial.",
                        error,
                    );
                } finally {
                    markAccountInitialSyncLoaded(
                        userId,
                    );

                    if (
                        isActive
                    ) {
                        setIsReady(
                            true,
                        );
                    }
                }
            };

        void initializeAccount();

        return () => {
            isActive =
                false;
        };
    }, [
        user,
        queueLocalSave,
    ]);

    /*
     * Sincronización localStorage → Supabase.
     *
     * Mientras la aplicación está abierta no existe
     * sincronización automática Supabase → localStorage.
     */
    useEffect(() => {
        if (
            !user ||
            !isReady
        ) {
            return;
        }

        const userId =
            user.id;

        let saveTimer:
            number | null =
            null;

        const runSave =
            (): void => {
                void queueLocalSave(
                    userId,
                ).catch(
                    (
                        error,
                    ) => {
                        logSyncError(
                            "No fue posible guardar los cambios automáticos.",
                            error,
                        );
                    },
                );
            };

        const scheduleSave =
            (): void => {
                if (
                    saveTimer !==
                    null
                ) {
                    window.clearTimeout(
                        saveTimer,
                    );
                }

                /*
                 * Cada nuevo cambio reinicia el contador.
                 *
                 * Por ejemplo, al hacer:
                 *
                 * R1 → R2 → R3
                 *
                 * se guarda finalmente R3, sin interrumpir
                 * los clics intermedios.
                 */
                saveTimer =
                    window.setTimeout(
                        () => {
                            saveTimer =
                                null;

                            runSave();
                        },
                        SAVE_DELAY_MS,
                    );
            };

        const handleStorageChanged = (
            event: Event,
        ): void => {
            const customEvent =
                event as CustomEvent<
                    AcademicStorageChangedDetail
                >;

            if (
                customEvent.detail
                    ?.userId !==
                userId
            ) {
                return;
            }

            /*
             * Ignora eventos generados durante
             * la hidratación inicial.
             */
            if (
                isHydratingFromCloudRef.current
            ) {
                return;
            }

            scheduleSave();
        };

        /*
         * Al ocultar la pestaña se intenta guardar inmediatamente,
         * pero nunca se trae una copia remota ni se recarga.
         */
        const handleVisibilityChange =
            (): void => {
                if (
                    document.visibilityState !==
                    "hidden"
                ) {
                    return;
                }

                if (
                    hasAccountStorageDirtyChanges(
                        userId,
                    )
                ) {
                    runSave();
                }
            };

        /*
         * pagehide también cubre algunos cierres,
         * navegaciones y cambios de página.
         */
        const handlePageHide =
            (): void => {
                if (
                    hasAccountStorageDirtyChanges(
                        userId,
                    )
                ) {
                    runSave();
                }
            };

        window.addEventListener(
            ACADEMIC_STORAGE_CHANGED_EVENT,
            handleStorageChanged,
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );

        window.addEventListener(
            "pagehide",
            handlePageHide,
        );

        /*
         * No consulta Supabase.
         *
         * Solo reintenta guardar si todavía existe
         * una modificación local pendiente.
         */
        const safetyIntervalId =
            window.setInterval(
                () => {
                    if (
                        hasAccountStorageDirtyChanges(
                            userId,
                        )
                    ) {
                        runSave();
                    }
                },
                SAFETY_SAVE_INTERVAL_MS,
            );

        if (
            hasAccountStorageDirtyChanges(
                userId,
            )
        ) {
            scheduleSave();
        }

        return () => {
            window.removeEventListener(
                ACADEMIC_STORAGE_CHANGED_EVENT,
                handleStorageChanged,
            );

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );

            window.removeEventListener(
                "pagehide",
                handlePageHide,
            );

            window.clearInterval(
                safetyIntervalId,
            );

            if (
                saveTimer !==
                null
            ) {
                window.clearTimeout(
                    saveTimer,
                );
            }
        };
    }, [
        user,
        isReady,
        queueLocalSave,
    ]);

    if (
        !isReady
    ) {
        return (
            <div
                className="academic-sync-loading"
                role="status"
                aria-live="polite"
            >
                <span
                    className="academic-sync-loading__spinner"
                    aria-hidden="true"
                />

                <strong>
                    Preparando tu cuenta
                </strong>

                <p>
                    Recuperando tu información académica...
                </p>
            </div>
        );
    }

    return children;
};