import { validateOptions } from './validation';

describe('validateOptions', () => {
  it('should not throw for valid options', () => {
    const options = { root: '/some/path' };
    expect(() => validateOptions(options)).not.toThrow();
  });

  it('should throw if options is not an object', () => {
    expect(() => validateOptions(null as unknown as any)).toThrow(
      'Executor options are required.'
    );
    expect(() => validateOptions('string' as unknown as any)).toThrow(
      'Executor options are required.'
    );
  });

  it('should throw if root is missing', () => {
    const options = {} as any;
    expect(() => validateOptions(options)).toThrow(
      'Option "root" is required and must be a non-empty string.'
    );
  });

  it('should throw if root is empty', () => {
    const options = { root: '' };
    expect(() => validateOptions(options)).toThrow(
      'Option "root" is required and must be a non-empty string.'
    );
  });
});
