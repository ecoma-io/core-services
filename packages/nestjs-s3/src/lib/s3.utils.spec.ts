import { delay } from './s3.utils';

describe('S3 Utils', () => {
  describe('delay', () => {
    // Use fake timers for Jest to control time in tests
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after the specified time', async () => {
      // Arrange: Set up the delay time, create the promise, and initialize a flag to track resolution
      const ms = 1000;
      const promise = delay(ms);
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      // Assert: Initially, the promise should not be resolved
      expect(resolved).toBe(false);

      // Act: Advance the timers by the specified milliseconds and await the promise
      jest.advanceTimersByTime(ms);
      await promise;

      // Assert: After the delay, the promise should be resolved
      expect(resolved).toBe(true);
    });
  });
});
