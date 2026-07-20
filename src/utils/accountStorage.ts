import type {
    AcademicData,
    AcademicStorageChangedDetail,
} from "../types/academicSync";

export const ACADEMIC_STORAGE_CHANGED_EVENT =
    "pensum:academic-storage-changed";

const ACCOUNT_STORAGE_PREFIX =
    "pensum-account:";

const ACCOUNT_SYNC_DIRTY_PREFIX =
    "pensum-account-sync-dirty:";

const ACCOUNT_INITIAL_SYNC_PREFIX =
    "pensum-account-sync-loaded:";

const getAccountStoragePrefix = (
    userId: string,
): string => {
    return `${ACCOUNT_STORAGE_PREFIX}${userId}:`;
};

const getAccountDirtyKey = (
    userId: string,
): string => {
    return `${ACCOUNT_SYNC_DIRTY_PREFIX}${userId}`;
};

const getAccountInitialSyncKey = (
    userId: string,
): string => {
    return `${ACCOUNT_INITIAL_SYNC_PREFIX}${userId}`;
};

const parseStoredValue = (
    value: string,
): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

export const buildAccountStorageKey = (
    userId: string,
    originalKey: string,
): string => {
    return `${getAccountStoragePrefix(
        userId,
    )}${originalKey}`;
};

export const readAccountAcademicData = (
    userId: string,
): AcademicData => {
    const accountPrefix =
        getAccountStoragePrefix(
            userId,
        );

    const academicData: AcademicData =
        {};

    const storageKeys =
        Object.keys(
            window.localStorage,
        );

    for (
        const storageKey
        of storageKeys
    ) {
        if (
            !storageKey.startsWith(
                accountPrefix,
            )
        ) {
            continue;
        }

        const originalKey =
            storageKey.slice(
                accountPrefix.length,
            );

        const storedValue =
            window.localStorage.getItem(
                storageKey,
            );

        if (
            storedValue === null
        ) {
            continue;
        }

        academicData[originalKey] =
            parseStoredValue(
                storedValue,
            );
    }

    return academicData;
};

export const replaceAccountAcademicData = (
    userId: string,
    academicData: AcademicData,
): void => {
    const accountPrefix =
        getAccountStoragePrefix(
            userId,
        );

    const existingKeys =
        Object.keys(
            window.localStorage,
        ).filter((storageKey) =>
            storageKey.startsWith(
                accountPrefix,
            ),
        );

    for (
        const storageKey
        of existingKeys
    ) {
        window.localStorage.removeItem(
            storageKey,
        );
    }

    for (
        const [
            originalKey,
            value,
        ]
        of Object.entries(
            academicData,
        )
    ) {
        const storageKey =
            buildAccountStorageKey(
                userId,
                originalKey,
            );

        window.localStorage.setItem(
            storageKey,
            JSON.stringify(
                value,
            ),
        );
    }
};

export const markAccountStorageDirty = (
    userId: string,
): void => {
    const marker =
        `${Date.now()}-${Math.random()}`;

    window.localStorage.setItem(
        getAccountDirtyKey(
            userId,
        ),
        marker,
    );
};

export const getAccountStorageDirtyMarker = (
    userId: string,
): string | null => {
    return window.localStorage.getItem(
        getAccountDirtyKey(
            userId,
        ),
    );
};

export const hasAccountStorageDirtyChanges = (
    userId: string,
): boolean => {
    return (
        getAccountStorageDirtyMarker(
            userId,
        ) !== null
    );
};

export const clearAccountStorageDirty = (
    userId: string,
    expectedMarker: string | null,
): void => {
    const currentMarker =
        getAccountStorageDirtyMarker(
            userId,
        );

    /*
     * Si hubo otro cambio mientras se guardaban
     * los datos anteriores, no eliminamos la marca.
     */
    if (
        currentMarker !==
        expectedMarker
    ) {
        return;
    }

    window.localStorage.removeItem(
        getAccountDirtyKey(
            userId,
        ),
    );
};

export const notifyAcademicStorageChanged = (
    userId: string,
    storageKey: string,
): void => {
    const detail:
        AcademicStorageChangedDetail = {
        userId,
        storageKey,
    };

    window.dispatchEvent(
        new CustomEvent<
            AcademicStorageChangedDetail
        >(
            ACADEMIC_STORAGE_CHANGED_EVENT,
            {
                detail,
            },
        ),
    );
};

export const hasAccountInitialSyncLoaded = (
    userId: string,
): boolean => {
    return (
        window.sessionStorage.getItem(
            getAccountInitialSyncKey(
                userId,
            ),
        ) === "true"
    );
};

export const markAccountInitialSyncLoaded = (
    userId: string,
): void => {
    window.sessionStorage.setItem(
        getAccountInitialSyncKey(
            userId,
        ),
        "true",
    );
};

export const clearAccountInitialSyncLoaded = (
    userId: string,
): void => {
    window.sessionStorage.removeItem(
        getAccountInitialSyncKey(
            userId,
        ),
    );
};