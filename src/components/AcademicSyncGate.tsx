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

const CLOUD_REFRESH_INTERVAL_MS =
    20000;

const CLOUD_REVISION_PREFIX =
    "pensum-account-cloud-revision:";

const getCloudRevisionKey = (
    userId: string,
): string => {
    return `${CLOUD_REVISION_PREFIX}${userId}`;
};

const readCloudRevision = (
    userId: string,
): string | null => {
    return window.sessionStorage.getItem(
        getCloudRevisionKey(
            userId,
        ),
    );
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

    const lastKnownCloudUpdatedAtRef =
        useRef<string | null>(
            user
                ? readCloudRevision(
                    user.id,
                )
                : null,
        );

    const saveQueueRef =
        useRef<Promise<void>>(
            Promise.resolve(),
        );

    useEffect(() => {
        lastKnownCloudUpdatedAtRef.current =
            user
                ? readCloudRevision(
                    user.id,
                )
                : null;
    }, [user]);

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

                                const updatedAt =
                                    await saveAcademicSnapshot(
                                        userId,
                                        academicData,
                                    );

                                lastKnownCloudUpdatedAtRef.current =
                                    updatedAt;

                                saveCloudRevision(
                                    userId,
                                    updatedAt,
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

    useEffect(() => {
        if (!user) {
            setIsReady(true);
            return;
        }

        const userId =
            user.id;

        if (
            hasAccountInitialSyncLoaded(
                userId,
            )
        ) {
            setIsReady(true);

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

        setIsReady(false);

        const initializeAccount =
            async (): Promise<void> => {
                try {
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

                    if (cloudSnapshot) {
                        lastKnownCloudUpdatedAtRef.current =
                            cloudSnapshot.updatedAt;

                        saveCloudRevision(
                            userId,
                            cloudSnapshot.updatedAt,
                        );

                        replaceAccountAcademicData(
                            userId,
                            cloudSnapshot.academicData,
                        );

                        return;
                    }

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
                    logSyncError(
                        "No fue posible realizar la carga inicial.",
                        error,
                    );
                } finally {
                    markAccountInitialSyncLoaded(
                        userId,
                    );

                    if (isActive) {
                        setIsReady(true);
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
     * Alexa modifica el snapshot directamente en Supabase.
     * Esta verificación trae esos cambios al navegador sin
     * obligar al usuario a cerrar sesión o limpiar datos.
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

        let isChecking =
            false;

        let isDisposed =
            false;

        const refreshFromCloud =
            async (): Promise<void> => {
                if (
                    isChecking ||
                    isDisposed ||
                    hasAccountStorageDirtyChanges(
                        userId,
                    )
                ) {
                    return;
                }

                isChecking =
                    true;

                try {
                    const cloudSnapshot =
                        await getAcademicSnapshot(
                            userId,
                        );

                    if (
                        !cloudSnapshot ||
                        isDisposed
                    ) {
                        return;
                    }

                    const knownUpdatedAt =
                        lastKnownCloudUpdatedAtRef.current ??
                        readCloudRevision(
                            userId,
                        );

                    if (!knownUpdatedAt) {
                        lastKnownCloudUpdatedAtRef.current =
                            cloudSnapshot.updatedAt;

                        saveCloudRevision(
                            userId,
                            cloudSnapshot.updatedAt,
                        );

                        return;
                    }

                    if (
                        cloudSnapshot.updatedAt ===
                        knownUpdatedAt
                    ) {
                        return;
                    }

                    replaceAccountAcademicData(
                        userId,
                        cloudSnapshot.academicData,
                    );

                    lastKnownCloudUpdatedAtRef.current =
                        cloudSnapshot.updatedAt;

                    saveCloudRevision(
                        userId,
                        cloudSnapshot.updatedAt,
                    );

                    window.location.reload();
                } catch (error) {
                    logSyncError(
                        "No fue posible revisar cambios realizados desde Alexa.",
                        error,
                    );
                } finally {
                    isChecking =
                        false;
                }
            };

        const handleWindowFocus =
            (): void => {
                void refreshFromCloud();
            };

        const handleVisibilityChange =
            (): void => {
                if (
                    document.visibilityState ===
                    "visible"
                ) {
                    void refreshFromCloud();
                }
            };

        const intervalId =
            window.setInterval(
                () => {
                    void refreshFromCloud();
                },
                CLOUD_REFRESH_INTERVAL_MS,
            );

        window.addEventListener(
            "focus",
            handleWindowFocus,
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );

        void refreshFromCloud();

        return () => {
            isDisposed =
                true;

            window.clearInterval(
                intervalId,
            );

            window.removeEventListener(
                "focus",
                handleWindowFocus,
            );

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [
        user,
        isReady,
    ]);

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
