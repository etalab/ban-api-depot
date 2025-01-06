import { HttpModule } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { BanService } from './ban.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        baseURL: configService.get('BAN_API_URL'),
        headers: {
          Authorization: `Token ${configService.get('BAN_API_TOKEN')}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [BanService, Logger],
  controllers: [],
  exports: [BanService],
})
export class BanModule {}
