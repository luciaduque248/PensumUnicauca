import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { useAuth } from "./useAuth";

const buildStorageKey = (
  originalKey: string,
  userId: string | null,
): string => {
  /*
   * El invitado continúa usando las claves originales.
   *
   * De esta manera conserva todos los datos que ya tenía
   * antes de agregar la autenticación.
   */
  if (!userId) {
    return originalKey;
  }

  /*
   * Cada cuenta autenticada recibe un espacio local
   * independiente.
   */
  return `pensum-account:${userId}:${originalKey}`;
};

const readStoredValue = <T>(
  storageKey: string,
  initialValue: T,
): T => {
  try {
    const savedValue =
      window.localStorage.getItem(
        storageKey,
      );

    if (savedValue !== null) {
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
    Dispatch<SetStateAction<T>>,
  ] {
  const {
    user,
  } = useAuth();

  const storageKey =
    buildStorageKey(
      key,
      user?.id ?? null,
    );

  const [
    storedValue,
    setStoredValue,
  ] = useState<T>(() =>
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
    } catch (error) {
      console.error(
        `No se pudo guardar la información en "${storageKey}".`,
        error,
      );
    }
  }, [
    storageKey,
    storedValue,
  ]);

  return [
    storedValue,
    setStoredValue,
  ];
}