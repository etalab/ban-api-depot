import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FileService } from './file.service';
import { S3Service } from './s3.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './file.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([File])],
  providers: [FileService, S3Service, Logger],
  exports: [FileService, S3Service],
})
export class FileModule {}
