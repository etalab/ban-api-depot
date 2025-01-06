import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { parse } from 'date-fns';

import {
  AuthorizationStrategyEnum,
  Client as Client2,
} from '@/modules/client/client.entity';
import { Revision } from '@/modules/revision/revision.entity';
import { StatModule } from './stats.module';
import { MailerService } from '@nestjs-modules/mailer';
import { Mandataire } from '../mandataire/mandataire.entity';
import { Habilitation } from '../habilitation/habilitation.entity';
import { File } from '../file/file.entity';
import { Perimeter } from '../chef_de_file/perimeters.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

process.env.FC_FS_ID = 'coucou';
process.env.ADMIN_TOKEN = 'xxxx';

@Global()
@Module({
  providers: [
    {
      provide: MailerService,
      useValue: {
        sendMail: jest.fn(),
      },
    },
  ],
  exports: [MailerService],
})
class MailerModule {}

describe('STATS MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let mandataireRepository: Repository<Mandataire>;
  let clientRepository: Repository<Client2>;
  let chefDeFileRepository: Repository<ChefDeFile>;
  let habilitationRepository: Repository<Habilitation>;
  let revisionRepository: Repository<Revision>;
  let fileRepository: Repository<File>;

  beforeAll(async () => {
    // INIT DB
    postgresContainer = await new PostgreSqlContainer().start();
    postgresClient = new Client({
      host: postgresContainer.getHost(),
      port: postgresContainer.getPort(),
      database: postgresContainer.getDatabase(),
      user: postgresContainer.getUsername(),
      password: postgresContainer.getPassword(),
    });
    await postgresClient.connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: postgresContainer.getHost(),
          port: postgresContainer.getPort(),
          username: postgresContainer.getUsername(),
          password: postgresContainer.getPassword(),
          database: postgresContainer.getDatabase(),
          synchronize: true,
          entities: [
            Client2,
            ChefDeFile,
            Perimeter,
            Habilitation,
            Revision,
            File,
            Mandataire,
          ],
        }),
        StatModule,
        MailerModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT MODEL
    mandataireRepository = app.get(getRepositoryToken(Mandataire));
    clientRepository = app.get(getRepositoryToken(Client2));
    chefDeFileRepository = app.get(getRepositoryToken(ChefDeFile));
    habilitationRepository = app.get(getRepositoryToken(Habilitation));
    revisionRepository = app.get(getRepositoryToken(Revision));
    fileRepository = app.get(getRepositoryToken(File));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await mandataireRepository.delete({});
    await clientRepository.delete({});
    await chefDeFileRepository.delete({});
    await habilitationRepository.delete({});
    await revisionRepository.delete({});
    await fileRepository.delete({});
  });

  async function createClient(props: Partial<Client2> = {}): Promise<Client2> {
    const mandataireToSave = mandataireRepository.create({
      nom: 'mandataire',
      email: 'mandataire@test.com',
    });
    const mandataire = await mandataireRepository.save(mandataireToSave);
    const chefDeFileToSave = chefDeFileRepository.create({
      nom: 'chefDeFile',
      email: 'chefDeFile@test.fr',
      isEmailPublic: true,
    });
    const chefDeFile = await chefDeFileRepository.save(chefDeFileToSave);
    const clientToSave: Client2 = clientRepository.create({
      ...props,
      nom: 'test',
      token: 'xxxx',
      authorizationStrategy: AuthorizationStrategyEnum.CHEF_DE_FILE,
      mandataireId: mandataire.id,
      chefDeFileId: chefDeFile.id,
    });
    return clientRepository.save(clientToSave);
  }

  async function createRevision(
    props: Partial<Revision> = {},
  ): Promise<Revision> {
    const client = await createClient();
    const revisionToSave: Revision = revisionRepository.create({
      clientId: client.id,
      ...props,
    });
    return revisionRepository.save(revisionToSave);
  }

  describe('GET /stats/firsts-publications', () => {
    it('GET /stats/firsts-publications forbiden', async () => {
      await request(app.getHttpServer())
        .get(`/stats/firsts-publications`)
        .expect(403);
    });

    it('GET /stats/firsts-publications empty', async () => {
      const response = await request(app.getHttpServer())
        .get(`/stats/firsts-publications`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      for (const item of response.body) {
        expect(item.totalCreations).toBe(0);
        expect(item.viaMesAdresses).toBe(0);
        expect(item.viaMoissonneur).toBe(0);
      }
    });

    it('GET /stats/firsts-publications with date', async () => {
      const from = '2000-01-01';
      const to = '2000-02-28';
      const response = await request(app.getHttpServer())
        .get(`/stats/firsts-publications?from=${from}&to=${to}`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body.length).toBe(59);
      for (const item of response.body) {
        expect(item.totalCreations).toBe(0);
        expect(item.viaMesAdresses).toBe(0);
        expect(item.viaMoissonneur).toBe(0);
      }
      expect(response.body[0].date).toBe('2000-01-01');
      expect(response.body[58].date).toBe('2000-02-28');
    });

    it('GET /stats/firsts-publications with date', async () => {
      await createRevision({
        codeCommune: '91400',
        publishedAt: parse('2000-01-02', 'yyyy-MM-dd', new Date()),
      });
      await createRevision({
        codeCommune: '91400',
        publishedAt: parse('2000-01-04', 'yyyy-MM-dd', new Date()),
      });
      await createRevision({
        codeCommune: '91400',
        publishedAt: parse('2000-03-02', 'yyyy-MM-dd', new Date()),
      });

      const response = await request(app.getHttpServer())
        .get(`/stats/firsts-publications?from=2000-01-01&to=2000-02-28`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body[0].totalCreations).toBe(0);
      for (let i = 1; i < response.body.length; i++) {
        expect(response.body[i].totalCreations).toBe(1);
      }

      const response2 = await request(app.getHttpServer())
        .get(`/stats/firsts-publications?from=2000-03-01&to=2000-03-28`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);
      for (const item of response2.body) {
        expect(item.totalCreations).toBe(1);
      }
    });
  });

  describe('GET /stats/firsts-publications', () => {
    it('GET /stats/publications forbiden', async () => {
      await request(app.getHttpServer()).get(`/stats/publications`).expect(403);
    });

    it('GET /stats/publications empty', async () => {
      const response = await request(app.getHttpServer())
        .get(`/stats/publications`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);
      expect(response.body).toEqual([]);
    });

    it('GET /stats/firsts-publications with date', async () => {
      const from = '2000-01-01';
      const to = '2000-02-28';
      const response = await request(app.getHttpServer())
        .get(`/stats/publications?from=${from}&to=${to}`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);
      expect(response.body).toEqual([]);
    });

    it('GET /stats/publications with date', async () => {
      await createRevision({
        codeCommune: '91400',
        publishedAt: parse('2000-01-02', 'yyyy-MM-dd', new Date()),
      });
      await createRevision({
        codeCommune: '91400',
        publishedAt: parse('2000-01-02', 'yyyy-MM-dd', new Date()),
      });
      const response = await request(app.getHttpServer())
        .get(`/stats/publications?from=2000-01-01&to=2000-02-28`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const resExpected = [
        {
          date: '2000-01-02',
          publishedBAL: {
            '91400': {
              total: 2,
              viaMesAdresses: 0,
              viaMoissonneur: 0,
            },
          },
        },
      ];
      expect(response.body).toEqual(resExpected);
    });
  });
});
