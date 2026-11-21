import { Request } from '@hapi/hapi';
import { AuthService } from '../services/auth.service';

export interface TokenRequestDto {
  clientId: string;
  clientSecret: string;
}

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  token = async (request: Request) => {
    const { clientId, clientSecret } = request.payload as TokenRequestDto;
    return this.auth.issueToken(clientId, clientSecret);
  };
}
