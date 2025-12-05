import { DomainException } from './domain.exception';

export class AggregateRootEventNotProvidedException extends DomainException {
  constructor(message = 'Event must be provided') {
    super(message);
  }
}
