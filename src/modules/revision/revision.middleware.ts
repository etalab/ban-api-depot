import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { RevisionService } from './revision.service';
import { Revision } from './revision.entity';
import { ObjectId } from 'bson';

@Injectable()
export class RevisionMiddleware implements NestMiddleware {
  constructor(private revisionService: RevisionService) {}

  async use(req: CustomRequest, res: Response, next: NextFunction) {
    const { revisionId } = req.params;
    if (revisionId) {
      if (!ObjectId.isValid(revisionId)) {
        throw new HttpException(
          `Revision Id ${revisionId} is not ObjectId`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const revision: Revision =
        await this.revisionService.findOneOrFail(revisionId);
      req.revision = revision;
    }
    next();
  }
}
