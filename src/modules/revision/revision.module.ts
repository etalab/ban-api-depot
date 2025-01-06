import {
  Logger,
  MiddlewareConsumer,
  Module,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CommuneMiddleware } from '@/lib/class/middlewares/commune.middleware';
import { ClientModule } from '@/modules/client/client.module';
import { FileModule } from '@/modules/file/file.module';
import { ChefDeFileModule } from '@/modules/chef_de_file/chef_de_file.module';
import { BanModule } from '@/modules/ban/ban.module';
import { HabilitationModule } from '@/modules/habilitation/habilitation.module';
import { MandataireModule } from '@/modules/mandataire/mandataire.module';
import { RevisionMiddleware } from './revision.middleware';
import { ValidationService } from './validation.service';
import { RevisionService } from './revision.service';
import { RevisionController } from './revision.controller';
import { NotifyService } from './notify.service';
import { PublicationController } from './publication.controller';
import { SlackModule } from 'nestjs-slack';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Revision } from './revision.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Revision]),
    ClientModule,
    FileModule,
    ChefDeFileModule,
    BanModule,
    HabilitationModule,
    MandataireModule,
    SlackModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'api',
        token: config.get('SLACK_TOKEN'),
        clientOptions: {
          retryConfig: { retries: 0 },
        },
      }),
    }),
  ],
  providers: [RevisionService, ValidationService, NotifyService, Logger],
  controllers: [RevisionController, PublicationController],
  exports: [RevisionService],
})
export class RevisionModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RevisionMiddleware).forRoutes(
      {
        path: 'revisions/:revisionId',
        method: RequestMethod.ALL,
      },
      {
        path: 'revisions/:revisionId/files/bal/download',
        method: RequestMethod.ALL,
      },
      {
        path: 'revisions/:revisionId/files/bal',
        method: RequestMethod.ALL,
      },
      {
        path: 'revisions/:revisionId/compute',
        method: RequestMethod.ALL,
      },
      {
        path: 'revisions/:revisionId/publish',
        method: RequestMethod.ALL,
      },
    );

    consumer.apply(CommuneMiddleware).forRoutes(
      {
        path: 'communes/:codeCommune/current-revision',
        method: RequestMethod.ALL,
      },
      {
        path: 'communes/:codeCommune/revisions',
        method: RequestMethod.ALL,
      },
      {
        path: 'communes/:codeCommune/current-revision/files/bal/download',
        method: RequestMethod.ALL,
      },
    );
  }
}
