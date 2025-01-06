import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';

import { CustomRequest } from '@/lib/types/request.type';
import { ChefDeFileService } from './chef_de_file.service';
import { ObjectId } from 'bson';
import { ChefDeFile } from './chef_de_file.entity';

@Injectable()
export class ChefDeFileMiddleware implements NestMiddleware {
  constructor(private chefDeFileService: ChefDeFileService) {}

  async use(req: CustomRequest, res: Response, next: NextFunction) {
    const { chefDeFileId } = req.params;

    if (chefDeFileId) {
      if (!ObjectId.isValid(chefDeFileId)) {
        throw new HttpException(
          `Chef de file Id ${chefDeFileId} is not ObjectId`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const chefDeFile: ChefDeFile =
        await this.chefDeFileService.findOneOrFail(chefDeFileId);
      req.chefDeFile = chefDeFile;
    }
    next();
  }
}
