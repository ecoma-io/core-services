import publishExecutor from './publish';
import { ExecutorContext } from '@nx/devkit';

jest.mock('../../utils/validation');
jest.mock('../../utils/path-resolution');
jest.mock('../../utils/file-check');
jest.mock('../../utils/version-handling');
jest.mock('../../utils/npm-publish');
jest.mock('../../utils/wildcard-dependencies');

describe('publishExecutor', () => {
  const mockValidateOptions = jest.fn();
  const mockResolvePackageRoot = jest.fn();
  const mockEnsurePackageJsonExists = jest.fn();
  const mockGetValidVersion = jest.fn();
  const mockDetermineTag = jest.fn();
  const mockUpdatePackageVersion = jest.fn();
  const mockRunNpmPublish = jest.fn();
  const mockCheckWildcardDependencies = jest.fn();

  beforeAll(() => {
    const validation = require('../../utils/validation');
    validation.validateOptions = mockValidateOptions;

    const pathResolution = require('../../utils/path-resolution');
    pathResolution.resolvePackageRoot = mockResolvePackageRoot;

    const fileCheck = require('../../utils/file-check');
    fileCheck.ensurePackageJsonExists = mockEnsurePackageJsonExists;

    const versionHandling = require('../../utils/version-handling');
    versionHandling.getValidVersion = mockGetValidVersion;
    versionHandling.determineTag = mockDetermineTag;
    versionHandling.updatePackageVersion = mockUpdatePackageVersion;

    const npmPublish = require('../../utils/npm-publish');
    npmPublish.runNpmPublish = mockRunNpmPublish;

    const wildcardDependencies = require('../../utils/wildcard-dependencies');
    wildcardDependencies.checkWildcardDependencies =
      mockCheckWildcardDependencies;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute successfully', async () => {
    const options = { root: '/path' };
    const context = {} as ExecutorContext;

    mockResolvePackageRoot.mockReturnValue('/resolved/root');
    mockGetValidVersion.mockReturnValue('1.0.0');
    mockDetermineTag.mockReturnValue('latest');
    mockUpdatePackageVersion.mockReturnValue({
      name: 'test',
      version: '1.0.0',
    });

    const result = await publishExecutor(options, context);

    expect(result.success).toBe(true);
    expect(mockValidateOptions).toHaveBeenCalledWith(options);
    expect(mockResolvePackageRoot).toHaveBeenCalledWith(options, context);
    expect(mockEnsurePackageJsonExists).toHaveBeenCalledWith(
      '/resolved/root/package.json'
    );
    expect(mockGetValidVersion).toHaveBeenCalledWith(
      options,
      context,
      '/resolved/root/package.json'
    );
    expect(mockDetermineTag).toHaveBeenCalledWith('1.0.0');
    expect(mockUpdatePackageVersion).toHaveBeenCalledWith(
      '/resolved/root/package.json',
      '1.0.0'
    );
    expect(mockCheckWildcardDependencies).toHaveBeenCalled();
    expect(mockRunNpmPublish).toHaveBeenCalled();
  });

  it('should return failure on error', async () => {
    const options = { root: '/path' };
    const context = {} as ExecutorContext;

    const nx = require('@nx/devkit');
    const spyError = jest.spyOn(nx.logger, 'error').mockImplementation(() => {
      // do nothing
    });
    mockValidateOptions.mockImplementation(() => {
      throw new Error('Validation error');
    });

    const result = await publishExecutor(options, context);

    expect(result.success).toBe(false);
    expect(spyError).toHaveBeenCalled();

    spyError.mockRestore();
  });

  it('should return failure and log when a non-Error is thrown', async () => {
    const options = { root: '/path' };
    const context = {} as ExecutorContext;

    mockValidateOptions.mockImplementation(() => {
      // throw a non-Error value to hit the alternate branch
      throw 'string error';
    });

    const nx = require('@nx/devkit');
    const spyError = jest.spyOn(nx.logger, 'error').mockImplementation(() => {
      // do nothing
    });

    const result = await publishExecutor(options, context);

    expect(result.success).toBe(false);
    expect(spyError).toHaveBeenCalled();

    spyError.mockRestore();
  });
});
