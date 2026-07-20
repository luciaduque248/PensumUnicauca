import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  useAuth,
} from "./useAuth";

import {
  buildAccountStorageKey,
  markAccountStorageDirty,
  notifyAcademicStorageChanged,
} from "../utils/accountStorage";

const readStoredValue = <T>(
  storageKey: string,
  initialValue: T,
): T => {
  try {
    const savedValue =
      window.localStorage.getItem(
        storageKey,
      );

    if (
      savedValue !== null
    ) {
      return JSON.parse(
        savedValue,
      ) as T;
    }

    return initialValue;
  } catch (error) {
    console.error(
      `No se pudo leer la información guardada en "${storageKey}".`,
      error,
    );

    return initialValue;
  }
};

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [
    T,
    Dispatch<
      SetStateAction<T>
    >,
  ] {
  const {
    user,
  } = useAuth();

  const userId =
    user?.id ??
    null;

  const storageKey =
    userId
      ? buildAccountStorageKey(
        userId,
        key,
      )
      : key;

  const [
    storedValue,
    setStoredValue,
  ] =
    useState<T>(
      () =>
        readStoredValue(
          storageKey,
          initialValue,
        ),
    );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(
          storedValue,
        ),
      );

      /*
       * Solo las cuentas registradas se
       * marcan para sincronización.
       *
       * El modo invitado nunca genera
       * solicitudes a Supabase.
       */
      if (userId) {
        markAccountStorageDirty(
          userId,
        );

        notifyAcademicStorageChanged(
          userId,
          storageKey,
        );
      }
    } catch (error) {
      console.error(
        `No se pudo guardar la información en "${storageKey}".`,
        error,
      );
    }
  }, [
    storageKey,
    storedValue,
    userId,
  ]);

  return [
    storedValue,
    setStoredValue,
  ];
}