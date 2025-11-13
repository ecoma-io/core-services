import { parseEnvContent, parseEnvFile } from './parse-env-file';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;

const TEST_VAR = 'TEST_VAR';

describe('parseEnvContent', () => {
  it('should parse basic key=value pairs', () => {
    const content = `
      KEY1=value1
      KEY2=value2
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should skip empty lines and comments', () => {
    const content = `
      # This is a comment
      KEY1=value1

      KEY2=value2
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should handle quoted values', () => {
    const content = `
      KEY1="quoted value"
      KEY2='single quoted'
      KEY3=unquoted value
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'quoted value',
      KEY2: 'single quoted',
      KEY3: 'unquoted value',
    });
  });

  it('should handle escaped characters', () => {
    const content = `
      KEY1=value\\nwith\\nnewlines
      KEY2=value\\twith\\ttabs
      KEY3=value\\"with\\"quotes
      KEY4=\\${TEST_VAR}
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value\nwith\nnewlines',
      KEY2: 'value\twith\ttabs',
      KEY3: 'value"with"quotes',
      KEY4: '\\TEST_VAR',
    });
  });

  it('should trim whitespace', () => {
    const content = `
      KEY1 = value1
      KEY2= value2
      KEY3 = value3
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
      KEY3: 'value3',
    });
  });

  it('should skip lines without equals sign', () => {
    const content = `
      KEY1=value1
      invalid line
      KEY2=value2
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should skip empty keys', () => {
    const content = `
      KEY1=value1
      =value2
      KEY3=value3
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY3: 'value3',
    });
  });

  it('should handle empty values', () => {
    const content = `
      KEY1=
      KEY2=value2
    `;
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: '',
      KEY2: 'value2',
    });
  });

  it('should return empty object for empty content', () => {
    const result = parseEnvContent('');
    expect(result).toEqual({});
  });

  it('should handle Windows line endings', () => {
    const content = 'KEY1=value1\r\nKEY2=value2\r\n';
    const result = parseEnvContent(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });
});

describe('parseEnvFile', () => {
  beforeEach(() => {
    // Arrange: Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should read and parse env file', () => {
    // Arrange: Mock readFileSync to return content
    const mockContent = 'KEY1=value1\nKEY2=value2';
    mockReadFileSync.mockReturnValue(mockContent);

    // Act: Call parseEnvFile with default cwd
    const result = parseEnvFile('.env');

    // Assert: Verify readFileSync was called and result is parsed correctly
    expect(mockReadFileSync).toHaveBeenCalledWith(
      join(process.cwd(), '.env'),
      'utf-8'
    );
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should use custom cwd', () => {
    // Arrange: Mock readFileSync and set custom cwd
    const mockContent = 'KEY1=value1';
    mockReadFileSync.mockReturnValue(mockContent);
    const customCwd = '/custom/path';

    // Act: Call parseEnvFile with custom cwd
    parseEnvFile('.env', customCwd);

    // Assert: Verify readFileSync was called with custom path
    expect(mockReadFileSync).toHaveBeenCalledWith(
      join(customCwd, '.env'),
      'utf-8'
    );
  });

  it('should throw error when file cannot be read', () => {
    // Arrange: Mock readFileSync to throw error
    const error = new Error('File not found');
    mockReadFileSync.mockImplementation(() => {
      throw error;
    });

    // Act & Assert: Verify parseEnvFile throws error
    expect(() => parseEnvFile('.env')).toThrow('Failed to read env file at');
  });
});
