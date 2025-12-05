/**
 * Returns the last element of an array, or a default value if the array is empty.
 * @remarks Avoids use of `any` by using `unknown` and type assertions.
 * @param {TArray} array - The array to get the last element from.
 * @param {TDefault} [defaultValue] - The default value to return if the array is empty.
 * @returns {TArray extends readonly [...unknown[], infer TLast] ? TLast : TArray[number] | TDefault} The last element or the default value.
 */
export function last<
  const TArray extends ReadonlyArray<unknown>,
  const TDefault = undefined,
>(
  array: TArray,
  defaultValue?: TDefault
): TArray extends readonly [...infer _Rest, infer TLast]
  ? TLast
  : TArray[number] | TDefault {
  return array && array.length > 0
    ? (array[array.length - 1] as TArray extends readonly [
        ...infer _Rest,
        infer TLast,
      ]
        ? TLast
        : TArray[number])
    : (defaultValue as TArray extends readonly [...infer _Rest, infer TLast]
        ? TLast
        : TDefault);
}
