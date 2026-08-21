import { expect, test } from './fixtures/canonicalAuthFixture';

test.describe('Canonical mocked OAuth flow', () => {
  test('persists one complete stateless session through the product callback', async ({
    canonicalAuth,
  }) => {
    test.setTimeout(90_000);
    await canonicalAuth.signIn();

    expect(canonicalAuth.routeState).toEqual({
      authorizeRequestCount: 1,
      tokenRequestCount: 1,
      verifyRequestCount: 1,
    });
  });
});
