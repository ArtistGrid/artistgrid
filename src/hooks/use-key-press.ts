import { useEffect, useRef } from "react";
export function useKeyPress(targetKey: string, callback: () => void): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    const handler = ({ key }: KeyboardEvent) => {
      if (key === targetKey) callbackRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [targetKey]);
}
