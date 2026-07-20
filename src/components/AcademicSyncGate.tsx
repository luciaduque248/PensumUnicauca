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

const SAVE_DELAY_MS =
    1200;

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
     * La cola evita que dos guardados terminen
     * en un orden diferente al esperado.
     */
    const saveQueueRef =
        useRef<
            Promise<void>
        >(
            Promise.resolve(),
        );

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
                                const dirtyMarker =
                                    getAccountStorageDirtyMarker(
                                        userId,
                                    );

                                const academicData =
                                    readAccountAcademicData(
                                        userId,
                                    );

                                await saveAcademicSnapshot(
                                    userId,
                                    academicData,
                                );

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
     * Solo se ejecuta una vez por cuenta durante
     * la sesión actual del navegador.
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
                    (error) => {
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
                     * Si había cambios locales pendientes,
                     * se guardan antes de descargar datos.
                     *
                     * Esto evita reemplazar cambios recientes
                     * con una versión anterior de la nube.
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
                        replaceAccountAcademicData(
                            userId,
                            cloudSnapshot
                                .academicData,
                        );

                        return;
                    }

                    /*
                     * Si todavía no existe una fila en
                     * Supabase, conservamos cualquier
                     * información local previa de esa cuenta.
                     */
                    const localAcademicData =
                        readAccountAcademicData(
                            userId,
                        );

                    if (
                        Object.keys(
                            localAcademicData,
                        ).length > 0
                    ) {
                        await queueLocalSave(
                            userId,
                        );
                    }
                } catch (error) {
                    /*
                     * La aplicación puede continuar usando
                     * localStorage aunque Supabase falle.
                     *
                     * La marca de cambios pendientes queda
                     * guardada para volver a intentarlo.
                     */
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
     * Guardado automático después de los cambios.
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

                saveTimer =
                    window.setTimeout(
                        () => {
                            void queueLocalSave(
                                userId,
                            ).catch(
                                (error) => {
                                    logSyncError(
                                        "No fue posible guardar los cambios automáticos.",
                                        error,
                                    );
                                },
                            );
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

            scheduleSave();
        };

        window.addEventListener(
            ACADEMIC_STORAGE_CHANGED_EVENT,
            handleStorageChanged,
        );

        /*
         * Si la página se recargó antes de terminar
         * el guardado anterior, se vuelve a intentar.
         */
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

    /*
     * Esta pantalla solo debe aparecer en la primera
     * carga de una cuenta durante la sesión actual.
     *
     * No aparece al cambiar entre Inicio, Horario,
     * Notas u otras vistas.
     */
    if (!isReady) {
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