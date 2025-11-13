import { S3Client, S3Clients, S3ClientProvider } from './s3.decorators';

describe('S3 Decorators', () => {
  /**
   * Tests for the S3Client decorator, which injects a single S3 client instance.
   */
  describe('S3Client', () => {
    it('should return a function for default client', () => {
      // Arrange: No specific setup required for this test
      // Act: Call the S3Client decorator with default parameters
      const decorator = S3Client();
      // Assert: Verify that the decorator returns a function
      expect(typeof decorator).toBe('function');
    });

    it('should return a function for custom client', () => {
      // Arrange: No specific setup required for this test
      // Act: Call the S3Client decorator with a custom client name
      const decorator = S3Client('custom');
      // Assert: Verify that the decorator returns a function
      expect(typeof decorator).toBe('function');
    });
  });

  /**
   * Tests for the S3Clients decorator, which injects multiple S3 client instances.
   */
  describe('S3Clients', () => {
    it('should return a function', () => {
      // Arrange: No specific setup required for this test
      // Act: Call the S3Clients decorator
      const decorator = S3Clients();
      // Assert: Verify that the decorator returns a function
      expect(typeof decorator).toBe('function');
    });
  });

  /**
   * Tests for the S3ClientProvider decorator, which provides S3 client configuration.
   */
  describe('S3ClientProvider', () => {
    it('should return a function for default name', () => {
      // Arrange: No specific setup required for this test
      // Act: Call the S3ClientProvider decorator with default parameters
      const decorator = S3ClientProvider();
      // Assert: Verify that the decorator returns a function
      expect(typeof decorator).toBe('function');
    });

    it('should return a function for custom name', () => {
      // Arrange: No specific setup required for this test
      // Act: Call the S3ClientProvider decorator with a custom name
      const decorator = S3ClientProvider('custom');
      // Assert: Verify that the decorator returns a function
      expect(typeof decorator).toBe('function');
    });
  });
});
