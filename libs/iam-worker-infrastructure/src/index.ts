// Public exports for iam-worker-projector
export * from './lib/base-projector';
// Explicit exports avoid duplicate symbol re-export conflicts
export { CheckpointRepositoryImpl } from './lib/checkpoint.repository';
export { UpcasterRegistryImpl } from './lib/upcaster.registry';
export * from './lib/adapters/rabbitmq-adapter';
export * from './projectors/tenant.projector';
export * from './projectors/user.projector';
export * from './projectors/role.projector';
export * from './projectors/membership.projector';
export * from './projectors/service-definition.projector';
// export * from './projectors/permission.projector'; // TODO: Fix to match BaseProjector signature
export * from './entities';
