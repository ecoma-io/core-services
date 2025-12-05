export type ParsedOtlpEndpoint =
  | { protocol: 'http' | 'https'; url: string }
  | { protocol: 'grpc' | 'grpcs'; host: string };

/**
 * Parse an OTLP (OpenTelemetry Protocol) endpoint string into a normalized descriptor.
 *
 * The function accepts HTTP(S) or gRPC endpoints and returns a small object that
 * describes the protocol and the value to use when configuring an OTLP exporter.
 * Leading and trailing whitespace are trimmed before parsing.
 *
 * Supported schemes:
 *  - http://  -> returns { protocol: 'http',  url: string }
 *  - https:// -> returns { protocol: 'https', url: string }
 *  - grpc://  -> returns { protocol: 'grpc',  host: string }
 *  - grpcs:// -> returns { protocol: 'grpcs', host: string }
 *
 * For HTTP(S) endpoints the returned object contains the full URL (including path).
 * For gRPC endpoints the returned object contains the host portion (authority, possibly including port).
 *
 * @param endpoint - The OTLP endpoint string to parse. Must be a non-empty string that starts with one of the supported schemes.
 *
 * @returns A ParsedOtlpEndpoint describing the parsed endpoint:
 *  - HTTP(S): { protocol: 'http' | 'https', url: string }
 *  - gRPC :   { protocol: 'grpc' | 'grpcs', host: string }
 *
 * @throws {TypeError} If the provided endpoint is empty or does not start with a supported scheme.
 *
 * @example
 * parseOtlpEndpoint('https://otel.example.com/v1/traces');
 * // => { protocol: 'https', url: 'https://otel.example.com/v1/traces' }
 *
 * @example
 * parseOtlpEndpoint('grpc://otel.example.com:4317');
 * // => { protocol: 'grpc', host: 'otel.example.com:4317' }
 */
export function parseOtlpEndpoint(endpoint: string): ParsedOtlpEndpoint {
  const url = String(endpoint || '').trim();
  if (!url) throw new TypeError('OTLP endpoint cannot be empty');

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { protocol: url.startsWith('https://') ? 'https' : 'http', url };
  }

  if (url.startsWith('grpc://') || url.startsWith('grpcs://')) {
    return {
      protocol: url.startsWith('grpcs://') ? 'grpcs' : 'grpc',
      host: url.replace(/^grpc(s)?:\/\//, ''),
    };
  }

  throw new TypeError(
    `Invalid OTLP endpoint URL: ${url}. Should start with http://, https://, grpc://, or grpcs://`
  );
}
