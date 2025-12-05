import { AdapterException } from './adapter.exception';

class ConcreteAdapterException extends (AdapterException as any) {
  constructor(message: string) {
    super(message);
  }
}

test('AdapterException marker and inheritance', () => {
  // Arrange & Act
  const ex = new ConcreteAdapterException('adapter fail');

  // Assert
  expect((ex as any).isAdapterException).toBe(true);
  expect(ex).toBeInstanceOf(Error);
});
