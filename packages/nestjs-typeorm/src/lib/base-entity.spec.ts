import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { BaseEntity } from './base-entity';

describe('BaseEntity metadata', () => {
  it('has createdAt column metadata', () => {
    // Arrange: Get the metadata storage for columns
    const cols = getMetadataArgsStorage().columns;

    // Act: Find the createdAt column for BaseEntity
    const created = cols.find(
      (c) => c.target === BaseEntity && c.propertyName === 'createdAt'
    );

    // Assert: Verify the column metadata exists
    expect(created).toBeDefined();
  });
});
