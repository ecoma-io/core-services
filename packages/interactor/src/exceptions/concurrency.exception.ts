export class ConcurrencyError extends Error {
  constructor(message = 'concurrency error') {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
