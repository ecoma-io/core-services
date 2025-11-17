# iam-worker-infrastructure

This library contains projector runtime components (worker) that consume domain events and materialize read models.

Purpose

- Provide base projector building blocks (lifecycle, upcast, checkpoint semantics).
- Provide adapters (RabbitMQ) and example projectors (UserProjector).

Quick start

- Configure `RABBITMQ_URL` and Postgres DataSource in your app that runs the projector.
- Run a simple worker that constructs `RabbitMqAdapter`, `UpcasterRegistryImpl`, `CheckpointRepositoryImpl`, `UserProjector` and call `start()`.

Notes

- This is a scaffold. Production-ready features (robust reconnect, backoff, DLQ, metrics) should be implemented before use.

# iam-worker-infrastructure

## Building

Run `npx nx build iam-worker-infrastructure` to build the library.

## Running unit tests

Run `npx nx test iam-worker-infrastructure` to execute the unit tests via [Jest](https://jestjs.io).
