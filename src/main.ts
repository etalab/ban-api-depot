import { NestFactory } from '@nestjs/core';
import * as session from 'express-session';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';
import { WinstonLogger } from './modules/logger/logger.service';
import { Logger } from './lib/utils/logger.utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger(Logger),
    cors: true,
  });

  const config = new DocumentBuilder()
    .setTitle('API depot')
    .setDescription(
      'API permettant le versionning des fichiers BALs des communes',
    )
    .setExternalDoc(
      'Documentation technique',
      'https://adresse-data-gouv-fr.gitbook.io/bal/api-depot',
    )
    .addServer(process.env.API_DEPOT_URL)
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: `Please enter the authentication admin token`,
        name: 'Authorization',
        type: 'http',
        in: 'Header',
      },
      'admin-token',
    )
    .addBearerAuth(
      {
        description: `Please enter the authentication client token`,
        name: 'Authorization',
        type: 'http',
        in: 'Header',
      },
      'client-token',
    )
    .addTag('publications', 'Procédure pour publier un BAL', {
      description: 'Documentation publication',
      url: 'https://adresse-data-gouv-fr.gitbook.io/bal/api-depot#publication-dune-bal',
    })
    .build();
  app.useGlobalPipes(new ValidationPipe());
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    }),
  );
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 4242);
}
bootstrap();
