import { parseOtlpEndpoint } from './otlp-endpoint';

describe('parseOtlpEndpoint', () => {
  test('returns http protocol and url for http endpoints', () => {
    // Arrange
    const input = 'http://localhost:4318';

    // Act
    const parsed = parseOtlpEndpoint(input);

    // Assert
    expect(parsed).toEqual({ protocol: 'http', url: 'http://localhost:4318' });
  });

  test('returns https protocol and url for https endpoints', () => {
    // Arrange
    const input = 'https://example.com';

    // Act
    const parsed = parseOtlpEndpoint(input);

    // Assert
    expect(parsed).toEqual({ protocol: 'https', url: 'https://example.com' });
  });

  test('returns grpc protocol and host for grpc endpoints', () => {
    // Arrange
    const input = 'grpc://host:4317';

    // Act
    const parsed = parseOtlpEndpoint(input);

    // Assert
    expect(parsed).toEqual({ protocol: 'grpc', host: 'host:4317' });
  });

  test('returns grpcs protocol and host for grpcs endpoints', () => {
    // Arrange
    const input = 'grpcs://host:4317';

    // Act
    const parsed = parseOtlpEndpoint(input);

    // Assert
    expect(parsed).toEqual({ protocol: 'grpcs', host: 'host:4317' });
  });

  test('throws for unsupported protocol', () => {
    // Arrange
    const input = 'unsupported://x';

    // Act & Assert
    expect(() => parseOtlpEndpoint(input)).toThrow(/Invalid OTLP endpoint URL/);
  });

  test('throws for empty endpoint', () => {
    // Arrange
    const input = '';

    // Act & Assert
    expect(() => parseOtlpEndpoint(input)).toThrow(
      /OTLP endpoint cannot be empty/
    );
  });

  test('trims surrounding whitespace before parsing', () => {
    // Arrange
    const input = '  http://a:4318  ';

    // Act
    const parsed = parseOtlpEndpoint(input);

    // Assert
    expect(parsed).toEqual({ protocol: 'http', url: 'http://a:4318' });
  });
});
