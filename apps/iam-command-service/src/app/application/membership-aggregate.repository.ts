import { Injectable } from '@nestjs/common';
import { MembershipAggregate } from '@ecoma-io/iam-domain';
import { EventStoreDbRepository } from '@ecoma-io/iam-infrastructure';

/**
 * MembershipAggregateRepository
 *
 * Repository for loading and saving Membership aggregates from/to EventStoreDB.
 * Follows the repository pattern for aggregate persistence.
 *
 * @see ADR-1: CQRS/ES - Aggregate repository pattern
 * @see ADR-6: Snapshot policy (to be integrated)
 */
@Injectable()
export class MembershipAggregateRepository {
  constructor(private readonly eventStoreRepo: EventStoreDbRepository) {}

  async load(membershipId: string): Promise<MembershipAggregate> {
    const events = await this.eventStoreRepo.loadEvents(
      `Membership-${membershipId}`
    );
    const aggregate = new MembershipAggregate(membershipId);

    events.forEach((env) => {
      aggregate['applyEvent'](env);
    });

    return aggregate;
  }

  async save(
    aggregate: MembershipAggregate
  ): Promise<{ streamVersion: number }> {
    const state = aggregate['_state'];
    const membershipId = state.membershipId;
    if (!membershipId) {
      throw new Error('Membership aggregate must have an ID');
    }

    const events = Array.from(aggregate.uncommittedEvents);
    const streamName = `Membership-${membershipId}`;

    // For new aggregates (version 0), use -1 for "stream does not exist"
    // For existing aggregates, use current version - 1
    const expectedVersion =
      aggregate.version === 0 ? -1 : aggregate.version - 1;

    await this.eventStoreRepo.saveEvents(streamName, events, expectedVersion);

    // Return the new stream version (EventStoreDB uses 0-based indexing)
    // If aggregate version is 0 and we write 1 event, stream version becomes 0
    return { streamVersion: aggregate.version + events.length - 1 };
  }
}
