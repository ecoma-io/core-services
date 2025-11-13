import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { BaseTimestampedEntity } from './base-timestamped-entity';

describe('BaseTimestampedEntity metadata', () => {
  it('has updatedAt column metadata', () => {
    // Arrange: Get the metadata storage for columns
    const cols = getMetadataArgsStorage().columns;

    // Act: Find the updatedAt column for BaseTimestampedEntity
    const updated = cols.find(
      (c) =>
        c.target === BaseTimestampedEntity && c.propertyName === 'updatedAt'
    );

    // Assert: Verify the column metadata exists
    expect(updated).toBeDefined();
  });
});
