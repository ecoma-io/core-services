import {
  readPackageJson,
  writePackageJson,
  getValidVersion,
  determineTag,
  updatePackageVersion,
} from './version-handling';
import * as fs from 'fs';
import * as semver from 'semver';
import { ExecutorContext } from '@nx/devkit';

jest.mock('fs');
jest.mock('semver');

describe('readPackageJson', () => {
  const mockReadFileSync = jest.mocked(fs.readFileSync);

  it('should read and parse package.json', () => {
    const content = '{"name": "test", "version": "1.0.0"}';
    mockReadFileSync.mockReturnValue(content);
    const result = readPackageJson('/path/package.json');
    expect(result).toStrictEqual({ name: 'test', version: '1.0.0' });
  });
});

describe('writePackageJson', () => {
  const mockWriteFileSync = jest.mocked(fs.writeFileSync);

  it('should write formatted package.json', () => {
    const pkg = { name: 'test', version: '1.0.0' };
    writePackageJson('/path/package.json', pkg);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/path/package.json',
      JSON.stringify(pkg, null, 2) + '\n',
      { encoding: 'utf-8' }
    );
  });
});

describe('getValidVersion', () => {
  const mockExistsSync = jest.mocked(fs.existsSync);
  const mockReadFileSync = jest.mocked(fs.readFileSync);
  const mockValid = jest.mocked(semver.valid);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get version from root package.json if syncRepoVersion is true', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"version": "2.0.0"}');
    mockValid.mockReturnValue('2.0.0');

    const result = getValidVersion(options, context, '/project/package.json');
    expect(result).toBe('2.0.0');
  });

  it('should get version from project package.json if syncRepoVersion is false', () => {
    const options = { root: '/dummy', syncRepoVersion: false };
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
    mockValid.mockReturnValue('1.0.0');

    const result = getValidVersion(options, context, '/project/package.json');
    expect(result).toBe('1.0.0');
  });

  it('should throw if version is invalid semver', () => {
    const options = { root: '/dummy', syncRepoVersion: false };
    const context = {} as unknown as ExecutorContext;
    mockReadFileSync.mockReturnValue('{"version": "invalid"}');
    mockValid.mockReturnValue(null);

    expect(() =>
      getValidVersion(options, context, '/project/package.json')
    ).toThrow('Invalid semver version: invalid');
  });

  it('should throw when root package.json is missing while syncing repo version', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    const mockExistsSync = jest.mocked(fs.existsSync);

    mockExistsSync.mockReturnValue(false);

    expect(() =>
      getValidVersion(options, context, '/project/package.json')
    ).toThrow('Root package.json not found');
  });

  it('should throw when project package.json has no version', () => {
    const options = { root: '/dummy', syncRepoVersion: false };
    const context = {} as unknown as ExecutorContext;
    const mockReadFileSync = jest.mocked(fs.readFileSync);
    const mockValid = jest.mocked(semver.valid);

    mockReadFileSync.mockReturnValue('{}');
    mockValid.mockReturnValue(null);

    expect(() =>
      getValidVersion(options, context, '/project/package.json')
    ).toThrow('Version not found in package.json');
  });

  it('should throw when root package.json exists but has no version while syncing repo version', () => {
    const options = { root: '/dummy', syncRepoVersion: true };
    const context = { root: '/workspace' } as unknown as ExecutorContext;
    const mockExistsSync = jest.mocked(fs.existsSync);
    const mockReadFileSyncLocal = jest.mocked(fs.readFileSync);

    mockExistsSync.mockReturnValue(true);
    // root package.json exists but has no version
    mockReadFileSyncLocal.mockReturnValue('{}');

    expect(() =>
      getValidVersion(options, context, '/project/package.json')
    ).toThrow('Version not found in root package.json');
  });
});

describe('determineTag', () => {
  const mockParse = jest.mocked(semver.parse);

  it('should return "latest" for stable version', () => {
    mockParse.mockReturnValue({ prerelease: [] } as unknown as semver.SemVer);
    expect(determineTag('1.0.0')).toBe('latest');
  });

  it('should return prerelease identifier for prerelease version', () => {
    mockParse.mockReturnValue({
      prerelease: ['beta', '1'],
    } as unknown as semver.SemVer);
    expect(determineTag('1.0.0-beta.1')).toBe('beta');
  });
});

describe('updatePackageVersion', () => {
  const mockReadFileSync = jest.mocked(fs.readFileSync);
  const mockWriteFileSync = jest.mocked(fs.writeFileSync);

  it('should update version in package.json', () => {
    const pkg = { name: 'test', version: '1.0.0' };
    mockReadFileSync.mockReturnValue(JSON.stringify(pkg));
    const result = updatePackageVersion('/path/package.json', '2.0.0');
    expect(result.version).toBe('2.0.0');
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
