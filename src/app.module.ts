import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

import { HabilitationModule } from '@/modules/habilitation/habilitation.module';
import { MandataireModule } from '@/modules/mandataire/mandataire.module';
import { ChefDeFileModule } from '@/modules/chef_de_file/chef_de_file.module';
import { ClientModule } from '@/modules/client/client.module';
import { RevisionModule } from '@/modules/revision/revision.module';
import { StatModule } from '@/modules/stats/stats.module';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChefDeFile } from './modules/chef_de_file/chef_de_file.entity';
import { Mandataire } from './modules/mandataire/mandataire.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../'),
      renderPath: 'public/',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('POSTGRES_URL'),
        keepConnectionAlive: true,
        schema: 'public',
        entities: [ChefDeFile, Mandataire],
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('MONGODB_URL'),
        dbName: config.get('MONGODB_DBNAME'),
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          ...(config.get('SMTP_HOST')
            ? {
                host: config.get('SMTP_HOST'),
                port: config.get('SMTP_PORT'),
                secure: config.get('SMTP_SECURE') === 'YES',
                auth: {
                  user: config.get('SMTP_USER'),
                  pass: config.get('SMTP_PASS'),
                },
              }
            : { streamTransport: true, newline: 'unix', buffer: true }),
        },
        defaults: {
          from: config.get('SMTP_FROM'),
        },
        template: {
          dir: __dirname + '/email-templates',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    HabilitationModule,
    ChefDeFileModule,
    MandataireModule,
    ClientModule,
    RevisionModule,
    StatModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
