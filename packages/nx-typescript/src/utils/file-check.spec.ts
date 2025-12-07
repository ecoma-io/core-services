import { ensurePackageJsonExists } from './file-check';
import * as fs from 'fs';

jest.mock('fs');

describe('ensurePackageJsonExists', () => {
  const mockExistsSync = jest.mocked(fs.existsSync);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw if file exists', () => {
    mockExistsSync.mockReturnValue(true);
    expect(() =>
      ensurePackageJsonExists('/path/to/package.json')
    ).not.toThrow();
  });

  it('should throw if file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => ensurePackageJsonExists('/path/to/package.json')).toThrow(
      'package.json not found at /path/to/package.json'
    );
  });
});
