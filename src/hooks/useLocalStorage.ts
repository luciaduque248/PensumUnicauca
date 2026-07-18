import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const savedValue = window.localStorage.getItem(key)

      if (savedValue !== null) {
        return JSON.parse(savedValue) as T
      }

      return initialValue
    } catch (error) {
      console.error(
        `No se pudo leer la información guardada en "${key}".`,
        error,
      )

      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(storedValue),
      )
    } catch (error) {
      console.error(
        `No se pudo guardar la información en "${key}".`,
        error,
      )
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}