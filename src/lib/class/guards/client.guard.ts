import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { omit } from 'lodash';

import { CustomRequest } from '@/lib/types/request.type';
import { ClientService } from '@/modules/client/client.service';

@Injectable()
export class ClientGuard implements CanActivate {
  constructor(private readonly clientService: ClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: CustomRequest = context.getArgByIndex(0);

    if (!req.get('Authorization')) {
      throw new HttpException(
        `Une authentification est nécessaire`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const [, token] = req.get('Authorization').split(' ');
    const client = await this.clientService.findOne({ token });

    if (!client) {
      throw new HttpException(
        `Authentification refusée`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!client.isActive) {
      throw new HttpException(
        'Le client est actuellement désactivé',
        HttpStatus.FORBIDDEN,
      );
    }

    req.client = omit(client, 'token');
    return true;
  }
}
