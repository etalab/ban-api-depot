import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { MandataireService } from './mandataire.service';
import { ObjectId } from 'bson';
import { Mandataire } from './mandataire.entity';

@Injectable()
export class MandataireMiddleware implements NestMiddleware {
  constructor(private mandataireService: MandataireService) {}

  async use(req: CustomRequest, res: Response, next: NextFunction) {
    const { mandataireId } = req.params;
    if (mandataireId) {
      if (!ObjectId.isValid(mandataireId)) {
        throw new HttpException(
          `Mandataire Id ${mandataireId} is not ObjectId`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const mandataire: Mandataire =
        await this.mandataireService.findOneOrFail(mandataireId);
      req.mandataire = mandataire;
    }
    next();
  }
}
