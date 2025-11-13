import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Parse environment variables from a .env file
 * @param envFilePath - Path to the .env file
 * @param cwd - Current working directory (optional, defaults to process.cwd())
 * @returns Record of environment variables
 */
export function parseEnvFile(
  envFilePath: string,
  cwd: string = process.cwd()
): Record<string, string> {
  const fullPath = join(cwd, envFilePath);

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return parseEnvContent(content);
  } catch (error) {
    throw new Error(`Failed to read env file at ${fullPath}: ${error.message}`);
  }
}

/**
 * Parse environment variables from string content
 * @param content - The content of the .env file as string
 * @returns Record of environment variables
 */
export function parseEnvContent(content: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex === -1) {
      // Skip lines without '='
      continue;
    }

    const key = trimmedLine.substring(0, equalIndex).trim();
    let value = trimmedLine.substring(equalIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\(\$\{[^}]+?\})/g, '$1');
    // Then handle common escape sequences
    value = value.replace(/\\n/g, '\n');
    value = value.replace(/\\r/g, '\r');
    value = value.replace(/\\t/g, '\t');
    value = value.replace(/\\"/g, '"');
    value = value.replace(/\\'/g, "'");

    // Skip empty keys
    if (key) {
      envVars[key] = value;
    }
  }

  return envVars;
}
