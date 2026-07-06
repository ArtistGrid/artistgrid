if (typeof Map !== "undefined" && !(Map.prototype as any).toSorted) {
  (Map.prototype as any).toSorted = function <K, V>(
    this: Map<K, V>,
    compareFn?: (a: [K, V], b: [K, V]) => number,
  ): Map<K, V> {
    return new Map([...this.entries()].sort(compareFn));
  };
}
