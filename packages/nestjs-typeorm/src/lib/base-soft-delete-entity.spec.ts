import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { BaseSoftDeleteEntity } from './base-soft-delete-entity';

describe('BaseSoftDeleteEntity metadata', () => {
  it('has deletedAt column metadata', () => {
    // Arrange: Get the metadata storage for columns
    const cols = getMetadataArgsStorage().columns;

    // Act: Find the deletedAt column for BaseSoftDeleteEntity
    const deleted = cols.find(
      (c) => c.target === BaseSoftDeleteEntity && c.propertyName === 'deletedAt'
    );

    // Assert: Verify the column metadata exists
    expect(deleted).toBeDefined();
  });
});
