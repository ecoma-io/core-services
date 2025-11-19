import * as vos from './index';

describe('value-objects index', () => {
  test('re-exports known value objects', () => {
    // Arrange & Act

    // Assert
    expect(vos.Email).toBeDefined();
    expect(vos.Password).toBeDefined();
    expect(vos.PhoneNumber).toBeDefined();
    expect(vos.PermissionKey).toBeDefined();
    expect(vos.NamespaceId).toBeDefined();
    expect(vos.RoleName).toBeDefined();
    expect(vos.ServiceName).toBeDefined();
  });
});
