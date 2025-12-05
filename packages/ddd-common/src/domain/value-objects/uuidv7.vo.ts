import { ValueObject } from './value-object';
import { uuidv7 } from 'uuidv7';

export class UuidV7VO extends ValueObject<string> {
  private constructor(private value?: string) {
    if (
      value &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value
      )
    ) {
      throw new Error('Invalid UUIDv7 format');
    }
    super(value ?? uuidv7());
  }

  public getValue(): string {
    return this.value;
  }
}
