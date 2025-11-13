/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * Used to introduce delays in retry logic.
 *
 * @param {number} ms - The delay time in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
