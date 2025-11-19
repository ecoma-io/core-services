import { InteractorException } from './interactor.exception';

class ExampleError extends InteractorException {}

describe('InteractorException', () => {
  it('type guard returns true for instances', () => {
    const e = new ExampleError('boom');
    expect(InteractorException.isInteractorException(e)).toBe(true);
  });

  it('type guard returns false for non-matching values', () => {
    expect(InteractorException.isInteractorException(null)).toBe(false);
    expect(InteractorException.isInteractorException({})).toBe(false);
    expect(InteractorException.isInteractorException(123)).toBe(false);
  });
});
