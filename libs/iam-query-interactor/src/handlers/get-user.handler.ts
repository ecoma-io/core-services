import { IQueryHandler, IReadModelRepository } from '@ecoma-io/interactor';
import { GetUserQuery } from '../queries/get-user.query';

export class GetUserHandler implements IQueryHandler<GetUserQuery, any> {
  constructor(private readonly repo: IReadModelRepository<any>) {}

  async execute(query: GetUserQuery): Promise<any> {
    const user = await this.repo.findById(query.userId);
    return user;
  }
}
