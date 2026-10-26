/** `arr[i]` for indices the caller knows are in range (noUncheckedIndexedAccess without `!`). */
export function at<T>(arr: readonly T[], i: number): T {
  const value = arr[i];
  if (value === undefined) throw new RangeError(`index ${i} out of range`);
  return value;
}
