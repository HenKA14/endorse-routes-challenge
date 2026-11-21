import Jwt from '@hapi/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../config/env';
import { InvalidCredentialsError } from '../errors/domain.errors';

export const SCOPES = {
  translate: 'endorse:translate',
  readTemplates: 'templates:read',
} as const;

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

const digest = (value: string) => createHash('sha256').update(value).digest();
/** Comparación en tiempo constante (evita timing attacks sobre el secreto). */
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * Emisión de JWT con flujo client_credentials simplificado. En un entorno real
 * el emisor sería un IdP (Cognito, Identity Platform, Keycloak) y este API solo
 * validaría; la validación ya está desacoplada en el plugin de auth.
 */
export class AuthService {
  constructor(private readonly config: AppConfig['auth']) {}

  issueToken(clientId: string, clientSecret: string): TokenResponse {
    const validId = safeEqual(clientId, this.config.clientId);
    const validSecret = safeEqual(clientSecret, this.config.clientSecret);
    if (!validId || !validSecret) {
      throw new InvalidCredentialsError();
    }

    const accessToken = Jwt.token.generate(
      {
        sub: clientId,
        aud: this.config.audience,
        iss: this.config.issuer,
        scope: [SCOPES.translate, SCOPES.readTemplates],
      },
      { key: this.config.jwtSecret, algorithm: 'HS256' },
      { ttlSec: this.config.ttlSeconds },
    );

    return { accessToken, tokenType: 'Bearer', expiresIn: this.config.ttlSeconds };
  }
}
