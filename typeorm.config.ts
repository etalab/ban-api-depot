import { File } from './src/modules/file/file.entity';
import { ChefDeFile } from './src/modules/chef_de_file/chef_de_file.entity';
import { Perimeter } from './src/modules/chef_de_file/perimeters.entity';
import { Client } from './src/modules/client/client.entity';
import { Habilitation } from './src/modules/habilitation/habilitation.entity';
import { Mandataire } from './src/modules/mandataire/mandataire.entity';
import { Revision } from './src/modules/revision/revision.entity';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URL,
  synchronize: false,
  logging: true,
  entities: [
    Client,
    Perimeter,
    ChefDeFile,
    Mandataire,
    Revision,
    Habilitation,
    File,
  ],
  migrationsRun: false,
  migrations: ['**/migrations/*.ts'],
});
