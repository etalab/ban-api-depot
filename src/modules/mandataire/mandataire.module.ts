import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MandataireService } from './mandataire.service';
import { MandataireController } from './mandataire.controller';
import { MandataireMiddleware } from './mandataire.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mandataire } from './mandataire.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Mandataire])],
  providers: [MandataireService],
  controllers: [MandataireController],
  exports: [MandataireService],
})
export class MandataireModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MandataireMiddleware).forRoutes(MandataireController);
  }
}
