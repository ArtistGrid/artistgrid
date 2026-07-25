import { useRef, useState } from "react";
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const valueRef = useRef(storedValue);
  const setValue = (value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(valueRef.current) : value;
    valueRef.current = valueToStore;
    setStoredValue(valueToStore);
    try {
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (e) {
      console.error(e);
    }
  };
  return [storedValue, setValue];
}
