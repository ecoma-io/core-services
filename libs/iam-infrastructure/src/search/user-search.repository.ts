import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface UserSearchDocument {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt: string;
}

/**
 * User Search Repository using Elasticsearch.
 *
 * @see ADR-2: Elasticsearch for full-text search
 */
@Injectable()
export class UserSearchRepository {
  private readonly logger = new Logger(UserSearchRepository.name);
  private readonly indexName = 'iam-users';

  constructor(private readonly client: Client) {}

  /**
   * Index a user document for search.
   */
  async index(doc: UserSearchDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: doc.userId,
        document: doc,
      });
    } catch (error) {
      this.logger.error('Failed to index user', error);
      throw error;
    }
  }

  /**
   * Delete user document from index.
   */
  async delete(userId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: userId,
      });
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Search users by query string.
   */
  async search(
    query: string,
    options?: {
      skip?: number;
      take?: number;
    }
  ): Promise<{ users: UserSearchDocument[]; total: number }> {
    try {
      const result = await this.client.search<UserSearchDocument>({
        index: this.indexName,
        from: options?.skip,
        size: options?.take,
        query: {
          multi_match: {
            query,
            fields: ['email^2', 'firstName', 'lastName'],
            fuzziness: 'AUTO',
          },
        },
      });

      const users = result.hits.hits
        .map((hit) => hit._source)
        .filter((source): source is UserSearchDocument => source !== undefined);
      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0);

      return { users, total };
    } catch (error) {
      this.logger.error('Failed to search users', error);
      throw error;
    }
  }

  /**
   * Create index with mapping if not exists.
   */
  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        mappings: {
          properties: {
            userId: { type: 'keyword' },
            email: { type: 'text' },
            firstName: { type: 'text' },
            lastName: { type: 'text' },
            status: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      this.logger.log(`Created index ${this.indexName}`);
    }
  }
}
