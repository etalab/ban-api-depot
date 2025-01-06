import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';

import { CommuneMiddleware } from '@/lib/class/middlewares/commune.middleware';
import { ApiAnnuaireModule } from '@/modules/api_annuaire/api_annuaire.module';
import { ClientModule } from '@/modules/client/client.module';
import { Habilitation } from './habilitation.entity';
import { HabilitationService } from './habilitation.service';
import { HabilitationController } from './habilitation.controller';
import { FranceConnectStrategy } from './france_connect/france_connect.strategy';
import {
  FranceConnectAuthGuard,
  FranceConnectCallBackGuard,
} from './france_connect/france_connect.guard';
import { HabilitationMiddleware } from './habilitation.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([Habilitation]),
    ApiAnnuaireModule,
    PassportModule.register({ session: true }),
    ClientModule,
  ],
  providers: [
    HabilitationService,
    FranceConnectStrategy,
    FranceConnectAuthGuard,
    FranceConnectCallBackGuard,
  ],
  controllers: [HabilitationController],
  exports: [HabilitationService],
})
export class HabilitationModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HabilitationMiddleware)
      .exclude({
        path: 'communes/:codeCommune/habilitations',
        method: RequestMethod.ALL,
      })
      .forRoutes(HabilitationController);

    consumer.apply(CommuneMiddleware).forRoutes({
      path: 'communes/:codeCommune/habilitations',
      method: RequestMethod.ALL,
    });
  }
}
