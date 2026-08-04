if (typeof Map !== "undefined" && !(Map.prototype as any).toSorted) {
  (Map.prototype as any).toSorted = function <K, V>(
    this: Map<K, V>,
    compareFn?: (a: [K, V], b: [K, V]) => number
  ): Map<K, V> {
    return new Map([...this.entries()].sort(compareFn));
  };
}

// Array.prototype.toSorted is unsupported on older browsers (e.g. iOS < 16)
// and throws "X.toSorted is not a function". Polyfill it (non-mutating sort).
if (typeof Array !== "undefined" && !(Array.prototype as any).toSorted) {
  (Array.prototype as any).toSorted = function <T>(this: T[], compareFn?: (a: T, b: T) => number): T[] {
    return [...this].sort(compareFn);
  };
}
