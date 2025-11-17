import { GetUserHandler } from '../handlers/get-user.handler';
import { makeGetUserQuery } from '../queries/get-user.query';

describe('GetUserHandler', () => {
  test('returns user from read repo', async () => {
    // Arrange
    const user = { id: 'u-1', email: 'x@y' };
    const mockRepo = { findById: jest.fn().mockResolvedValue(user) } as any;
    const handler = new GetUserHandler(mockRepo);
    const q = makeGetUserQuery('u-1');

    // Act
    const out = await handler.execute(q);

    // Assert
    expect(mockRepo.findById).toHaveBeenCalledWith('u-1');
    expect(out).toEqual(user);
  });
});
