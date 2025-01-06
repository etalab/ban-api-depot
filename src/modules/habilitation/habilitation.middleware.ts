import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { HabilitationService } from './habilitation.service';
import { Habilitation } from './habilitation.entity';
import { ObjectId } from 'bson';

@Injectable()
export class HabilitationMiddleware implements NestMiddleware {
  constructor(private habilitationService: HabilitationService) {}

  async use(req: CustomRequest, res: Response, next: NextFunction) {
    const { habilitationId } = req.params;
    if (habilitationId) {
      if (!ObjectId.isValid(habilitationId)) {
        throw new HttpException(
          `Habilitation Id ${habilitationId} is not ObjectId`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const habilitation: Habilitation =
        await this.habilitationService.findOneOrFail(habilitationId);
      req.habilitation = habilitation;
    }
    next();
  }
}
