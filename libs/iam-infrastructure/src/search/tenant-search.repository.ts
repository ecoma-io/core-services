import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface TenantSearchDocument {
  tenantId: string;
  name: string;
  namespace: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Tenant Search Repository using Elasticsearch.
 *
 * @see ADR-2: Elasticsearch for full-text search
 */
@Injectable()
export class TenantSearchRepository {
  private readonly logger = new Logger(TenantSearchRepository.name);
  private readonly indexName = 'iam-tenants';

  constructor(private readonly client: Client) {}

  /**
   * Index a tenant document for search.
   */
  async index(doc: TenantSearchDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: doc.tenantId,
        document: doc,
      });
    } catch (error) {
      this.logger.error('Failed to index tenant', error);
      throw error;
    }
  }

  /**
   * Delete tenant document from index.
   */
  async delete(tenantId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: tenantId,
      });
    } catch (error) {
      this.logger.error(`Failed to delete tenant ${tenantId}`, error);
      throw error;
    }
  }

  /**
   * Search tenants by query string.
   */
  async search(
    query: string,
    options?: {
      skip?: number;
      take?: number;
    }
  ): Promise<{ tenants: TenantSearchDocument[]; total: number }> {
    try {
      const result = await this.client.search<TenantSearchDocument>({
        index: this.indexName,
        from: options?.skip,
        size: options?.take,
        query: {
          multi_match: {
            query,
            fields: ['name^2', 'namespace'],
            fuzziness: 'AUTO',
          },
        },
      });

      const tenants = result.hits.hits
        .map((hit) => hit._source)
        .filter(
          (source): source is TenantSearchDocument => source !== undefined
        );
      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0);

      return { tenants, total };
    } catch (error) {
      this.logger.error('Failed to search tenants', error);
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
        body: {
          mappings: {
            properties: {
              tenantId: { type: 'keyword' },
              name: { type: 'text' },
              namespace: { type: 'keyword' },
              metadata: { type: 'object', enabled: false },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      this.logger.log(`Created index ${this.indexName}`);
    }
  }
}
