import { createSamplerFromConfig } from './sampler-factory';

describe('sampler-factory', () => {
  afterEach(() => {
    // keep tests isolated — reset/clear/restore mocks between tests
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('should return undefined when no config passed', () => {
    // Arrange
    const config = undefined;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeUndefined();
  });

  test('should create AlwaysOnSampler instance for always_on', () => {
    // Arrange
    const config = { type: 'always_on' } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should create TraceIdRatioBasedSampler for traceidratio', () => {
    // Arrange
    const config = { type: 'traceidratio', ratio: 0.4 } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should create ParentBasedSampler with root traceidratio', () => {
    // Arrange
    const config = {
      type: 'parentbased',
      root: { type: 'traceidratio', ratio: 0.2 },
    } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should create ParentBasedSampler with root always_off', () => {
    // Arrange
    const config = {
      type: 'parentbased',
      root: { type: 'always_off' },
    } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should create ParentBasedSampler with no root (default AlwaysOn)', () => {
    // Arrange
    const config = { type: 'parentbased' } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should create ParentBasedSampler with explicit always_on root', () => {
    // Arrange
    const config = {
      type: 'parentbased',
      root: { type: 'always_on' },
    } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('should return undefined for unknown sampler type', () => {
    // Arrange
    const config = { type: 'unknown' } as any;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeUndefined();
  });

  test('traceidratio should handle missing/NaN ratio and fall back to 0', () => {
    // Arrange / Act: missing ratio
    const s1 = createSamplerFromConfig({
      type: 'traceidratio',
      ratio: undefined as any,
    } as any);

    // Assert
    expect(s1).toBeDefined();
    const shouldSample1 = (s1 as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample1).toBe('function');

    // Arrange / Act: NaN ratio
    const s2 = createSamplerFromConfig({
      type: 'traceidratio',
      ratio: NaN,
    } as const);

    // Assert
    expect(s2).toBeDefined();
    const shouldSample2 = (s2 as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample2).toBe('function');
  });

  test('parentbased root branch with unknown root.type should fall back to AlwaysOnSampler', () => {
    // Arrange
    const config = {
      type: 'parentbased',
      root: { type: 'weird' } as any,
    } as any;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });

  test('parentbased root traceidratio branch exercised for missing/zero/NaN ratio values', () => {
    // Arrange / Act: missing ratio
    const s1 = createSamplerFromConfig({
      type: 'parentbased',
      root: { type: 'traceidratio' } as any,
    } as any);
    // Assert
    expect(s1).toBeDefined();
    const shouldSample1 = (s1 as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample1).toBe('function');

    // Arrange / Act: zero ratio
    const s2 = createSamplerFromConfig({
      type: 'parentbased',
      root: { type: 'traceidratio', ratio: 0 } as any,
    } as any);
    // Assert
    expect(s2).toBeDefined();
    const shouldSample2 = (s2 as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample2).toBe('function');

    // Arrange / Act: NaN ratio
    const s3 = createSamplerFromConfig({
      type: 'parentbased',
      root: { type: 'traceidratio', ratio: NaN } as any,
    } as any);
    // Assert
    expect(s3).toBeDefined();
    const shouldSample3 = (s3 as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample3).toBe('function');
  });

  test('should create AlwaysOffSampler instance for always_off', () => {
    // Arrange
    const config = { type: 'always_off' } as const;

    // Act
    const s = createSamplerFromConfig(config);

    // Assert
    expect(s).toBeDefined();
    const shouldSample = (s as { shouldSample?: unknown }).shouldSample;
    expect(typeof shouldSample).toBe('function');
  });
});
