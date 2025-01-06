import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ChefDeFileService } from './chef_de_file.service';
import { ChefDeFileController } from './chef_de_file.controller';
import { ChefDeFileMiddleware } from './chef_de_file.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChefDeFile } from './chef_de_file.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ChefDeFile])],
  providers: [ChefDeFileService],
  controllers: [ChefDeFileController],
  exports: [ChefDeFileService],
})
export class ChefDeFileModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ChefDeFileMiddleware).forRoutes(ChefDeFileController);
  }
}
