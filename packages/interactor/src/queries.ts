// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface IQuery {
  // marker interface for queries
}

export interface IQueryHandler<Q extends IQuery, R> {
  execute(query: Q): Promise<R>;
}
