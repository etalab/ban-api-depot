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
import MockAdapter from 'axios-mock-adapter';
import { sub } from 'date-fns';
import axios from 'axios';
import { MailerService } from '@nestjs-modules/mailer';

import {
  AuthorizationStrategyEnum,
  Client as Client2,
} from '../client/client.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { Mandataire } from '../mandataire/mandataire.entity';
import { RevisionModule } from './revision.module';
import { Habilitation } from '../habilitation/habilitation.entity';
import { Revision, StatusRevisionEnum } from './revision.entity';
import { S3Service } from '../file/s3.service';
import { File } from '../file/file.entity';
import { Repository } from 'typeorm';
import { Perimeter } from '../chef_de_file/perimeters.entity';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { ObjectId } from 'bson';

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

describe('REVISION MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let mandataireRepository: Repository<Mandataire>;
  let clientRepository: Repository<Client2>;
  let chefDeFileRepository: Repository<ChefDeFile>;
  let habilitationRepository: Repository<Habilitation>;
  let revisionRepository: Repository<Revision>;
  let fileRepository: Repository<File>;

  const axiosMock = new MockAdapter(axios);
  let s3Service: S3Service;

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
        RevisionModule,
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
    s3Service = app.get<S3Service>(S3Service);
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
    axiosMock.reset();
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
    const revisionToSave: Revision = revisionRepository.create({
      ...props,
    });
    return revisionRepository.save(revisionToSave);
  }

  describe('GET /current-revisions', () => {
    it('GET /current-revisions MULTI COMMUNE', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91477',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/current-revisions`)
        .expect(200);
      expect(body.length).toBe(2);
    });

    it('GET /current-revisions DETAIL ONE', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
        publishedAt: new Date(),
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/current-revisions`)
        .expect(200);

      expect(body.length).toBe(1);
      expect(body[0].codeCommune).toBe('91534');
      expect(body[0].id).toBeDefined();
      expect(body[0].publishedAt).toBeDefined;
      expect(body[0].client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });

    it('GET /current-revisions publishedSince 1 revisions', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
        publishedAt: sub(new Date(), { years: 1 }),
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
        publishedAt: sub(new Date(), { weeks: 1 }),
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/current-revisions?publishedSince=${sub(new Date(), { months: 1 })}`,
        )
        .expect(200);

      expect(body.length).toBe(1);
    });
  });

  describe('GET /communes/:codeCommune/current-revision', () => {
    it('GET /communes/:codeCommune/current-revision NOT EXIST', async () => {
      await request(app.getHttpServer())
        .get(`/communes/91400/current-revision`)
        .expect(404);
    });

    it('GET /communes/:codeCommune/current-revision', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
        publishedAt: sub(new Date(), { years: 1 }),
      });

      const { body } = await request(app.getHttpServer())
        .get(`/communes/91534/current-revision`)
        .expect(200);

      expect(body.codeCommune).toBe('91534');
      expect(body.status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body.isCurrent).toBe(true);
      expect(body.client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });
  });

  describe('GET /communes/:codeCommune/revisions', () => {
    it('GET /communes/:codeCommune/revisions NOT EXIST', async () => {
      await request(app.getHttpServer())
        .get(`/communes/91400/current-revision`)
        .expect(404);
    });

    it('GET /communes/:codeCommune/revisions', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/communes/91534/revisions`)
        .expect(200);

      expect(body.length).toBe(2);
      expect(body[0].codeCommune).toBe('91534');
      expect(body[0].status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body[0].isCurrent).toBe(true);
      expect(body[0].client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });

    it('GET /communes/:codeCommune/revisions?status=published', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/communes/91534/revisions?status=${StatusRevisionEnum.PUBLISHED}`)
        .expect(200);

      expect(body.length).toBe(2);
      expect(body[0].codeCommune).toBe('91534');
      expect(body[0].status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body[0].isCurrent).toBe(true);
      expect(body[0].client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });

    it('GET /communes/:codeCommune/revisions?status=pending', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/communes/91534/revisions?status=${StatusRevisionEnum.PENDING}`)
        .expect(200);

      expect(body.length).toBe(1);
      expect(body[0].codeCommune).toBe('91534');
      expect(body[0].status).toBe(StatusRevisionEnum.PENDING);
      expect(body[0].isCurrent).toBe(false);
      expect(body[0].client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });

    it('GET /communes/:codeCommune/revisions?status=all', async () => {
      const client: Client2 = await createClient();

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/communes/91534/revisions?status=all`)
        .expect(200);

      expect(body.length).toBe(3);
      expect(body[0].codeCommune).toBe('91534');
      expect(body[0].status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body[0].isCurrent).toBe(true);
      expect(body[0].client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });
  });

  describe('GET /communes/:codeCommune/current-revision/files/bal/download', () => {
    it('GET /communes/:codeCommune/current-revision/files/bal/download NOT EXIST', async () => {
      await request(app.getHttpServer())
        .get(`/communes/91400/current-revision`)
        .expect(404);
    });

    it('GET /communes/:codeCommune/current-revision/files/bal/download NOT CURRENT', async () => {
      const client: Client2 = await createClient();
      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: false,
      });

      await request(app.getHttpServer())
        .get(`/communes/91534/current-revision`)
        .expect(404);
    });

    it('GET /communes/:codeCommune/current-revision/files/bal/download NO FILE', async () => {
      const client: Client2 = await createClient();
      await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await request(app.getHttpServer())
        .get(`/communes/91534/current-revision/files/bal/download`)
        .expect(404);
    });

    it('GET /communes/:codeCommune/current-revision/files/bal/download', async () => {
      const client: Client2 = await createClient();
      const { id: revisionId } = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      const fileToSave: File = await fileRepository.create({
        id: new ObjectId().toHexString(),
        revisionId,
      });
      const file = await fileRepository.save(fileToSave);
      const fileData = Buffer.from('file data');

      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toBe(file.id);
          return fileData;
        });

      const response = await request(app.getHttpServer())
        .get(`/communes/91534/current-revision/files/bal/download`)
        .expect(200);
      expect(response.text).toEqual(fileData.toString());
    });
  });

  describe('GET /revisions/:revisionId', () => {
    it('GET /revisions/:revisionId BAD OBJECT ID', async () => {
      await request(app.getHttpServer()).get(`/revisions/coucou`).expect(400);
    });

    it('GET /revisions/:revisionId NOT EXIST', async () => {
      await request(app.getHttpServer())
        .get(`/revisions/${new ObjectId().toHexString()}`)
        .expect(404);
    });

    it('GET /revisions/:revisionId', async () => {
      const client: Client2 = await createClient();

      const { id } = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/revisions/${id}`)
        .expect(200);

      expect(body.codeCommune).toBe('91534');
      expect(body.status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body.isCurrent).toBe(true);
      expect(body.client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
    });
  });

  describe('GET /revisions/:revisionId/files/bal/download', () => {
    it('GET /revisions/:revisionId/files/bal/download BAD OBJECT ID', async () => {
      await request(app.getHttpServer())
        .get(`/revisions/coucou/files/bal/download`)
        .expect(400);
    });

    it('GET /revisions/:revisionId/files/bal/download NOT EXIST', async () => {
      await request(app.getHttpServer())
        .get(`/revisions/${new ObjectId().toHexString()}/files/bal/download`)
        .expect(404);
    });

    it('GET /revisions/:revisionId/files/bal/download NO FILE', async () => {
      const client: Client2 = await createClient();
      const { id } = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      await request(app.getHttpServer())
        .get(`/revisions/${id}/files/bal/download`)
        .expect(404);
    });

    it('GET /revisions/:revisionId/files/bal/download', async () => {
      const client: Client2 = await createClient();
      const { id: revisionId } = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });

      const fileToSave: File = await fileRepository.create({
        id: new ObjectId().toHexString(),
        revisionId,
      });
      const file = await fileRepository.save(fileToSave);

      const fileData = Buffer.from('file data');

      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toBe(file.id);
          return fileData;
        });

      const { text } = await request(app.getHttpServer())
        .get(`/revisions/${revisionId}/files/bal/download`)
        .expect(200);

      expect(text).toEqual(fileData.toString());
    });
  });
});
