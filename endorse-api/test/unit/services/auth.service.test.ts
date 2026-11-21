import Jwt from '@hapi/jwt';
import { loadConfig } from '../../../src/config/env';
import { InvalidCredentialsError } from '../../../src/errors/domain.errors';
import { AuthService, SCOPES } from '../../../src/services/auth.service';

describe('AuthService', () => {
  const config = loadConfig({ NODE_ENV: 'test' }).auth;
  const service = new AuthService(config);

  it('emite un JWT HS256 firmado con aud, iss, sub y scopes', () => {
    const response = service.issueToken(config.clientId, config.clientSecret);
    const decoded = Jwt.token.decode(response.accessToken);

    expect(() => Jwt.token.verify(decoded, { key: config.jwtSecret, algorithm: 'HS256' })).not.toThrow();
    expect(decoded.decoded.header.alg).toBe('HS256');
    expect(decoded.decoded.payload).toMatchObject({
      sub: config.clientId,
      aud: config.audience,
      iss: config.issuer,
      scope: [SCOPES.translate, SCOPES.readTemplates],
    });
    expect(response).toMatchObject({ tokenType: 'Bearer', expiresIn: config.ttlSeconds });
  });

  it.each([
    ['clientId incorrecto', 'otro', 'frontend-demo-secret'],
    ['secret incorrecto', 'frontend-demo', 'otro'],
    ['secret de distinta longitud', 'frontend-demo', 'x'],
  ])('rechaza %s', (_case, id, secret) => {
    expect(() => service.issueToken(id, secret)).toThrow(InvalidCredentialsError);
  });
});
