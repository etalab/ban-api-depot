import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  HttpException,
  HttpStatus,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import MockAdapter from 'axios-mock-adapter';
import { add } from 'date-fns';
import * as fs from 'fs';
import axios from 'axios';

import {
  AuthorizationStrategyEnum,
  Client as Client2,
} from '../client/client.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { Mandataire } from '../mandataire/mandataire.entity';
import { RevisionModule } from './revision.module';
import {
  Habilitation,
  StatusHabilitationEnum,
  TypeStrategyEnum,
} from '../habilitation/habilitation.entity';
import { Context, Revision, StatusRevisionEnum } from './revision.entity';
import { S3Service } from '../file/s3.service';
import { File } from '../file/file.entity';
import { join } from 'path';
import { MailerService } from '@nestjs-modules/mailer';
import { Repository } from 'typeorm';
import {
  Perimeter,
  TypePerimeterEnum,
} from '../chef_de_file/perimeters.entity';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { ObjectId } from 'bson';
import { generateToken } from '@/lib/utils/token.utils';
import { RevisionService } from './revision.service';

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

describe('PUBLICATION MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let revisionService: RevisionService;
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
    revisionService = app.get<RevisionService>(RevisionService);
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

  function readFile(relativePath: string) {
    const absolutePath = join(__dirname, 'mock', relativePath);
    return fs.readFileSync(absolutePath);
  }

  async function createClient(
    props: Partial<Client2> = {},
    propsChefDeFile: Partial<ChefDeFile> = {},
  ): Promise<Client2> {
    const mandataireToSave = mandataireRepository.create({
      nom: 'mandataire',
      email: 'mandataire@test.com',
    });
    const mandataire = await mandataireRepository.save(mandataireToSave);
    const chefDeFileToSave = chefDeFileRepository.create({
      nom: 'chefDeFile',
      email: 'chefDeFile@test.fr',
      isEmailPublic: true,
      ...propsChefDeFile,
    });
    const chefDeFile = await chefDeFileRepository.save(chefDeFileToSave);
    const clientToSave: Client2 = clientRepository.create({
      nom: 'test',
      token: 'xxxx',
      authorizationStrategy: AuthorizationStrategyEnum.CHEF_DE_FILE,
      mandataireId: mandataire.id,
      chefDeFileId: chefDeFile.id,
      ...props,
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

  async function createFile(props: Partial<File> = {}): Promise<File> {
    const fileToSave: File = await fileRepository.create({
      ...props,
    });
    return fileRepository.save(fileToSave);
  }

  async function createHabilitation(
    props: Partial<Habilitation> = {},
  ): Promise<Habilitation> {
    const habilitationToSave: Habilitation =
      await habilitationRepository.create({
        ...props,
      });
    return habilitationRepository.save(habilitationToSave);
  }

  describe('POST communes/:codeCommune/revisions', () => {
    it('GUARD CLIENT NO TOKEN', async () => {
      await request(app.getHttpServer())
        .post(`/communes/91534/revisions`)
        .expect(401);
    });

    it('GUARD CLIENT BAD TOKEN', async () => {
      await request(app.getHttpServer())
        .post(`/communes/91534/revisions`)
        .set('authorization', `Bearer xxxx`)
        .expect(401);
    });

    it('GUARD CLIENT INACTIF', async () => {
      const client: Client2 = await createClient({ isActive: false });

      await request(app.getHttpServer())
        .post(`/communes/91534/revisions`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('COMMUNE MIDDLEWARE', async () => {
      const client: Client2 = await createClient();

      await request(app.getHttpServer())
        .post(`/communes/coucou/revisions`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(404);
    });

    it('POST communes/:codeCommune/revisions without context', async () => {
      const client: Client2 = await createClient();

      const { body } = await request(app.getHttpServer())
        .post(`/communes/91534/revisions`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(400);

      expect(body.error).toBe('Bad Request');
    });

    it('POST communes/:codeCommune/revisions with context', async () => {
      const client: Client2 = await createClient();

      const context: Context = {
        organisation: 'organization',
        nomComplet: 'nomComplet',
        extras: {
          external_id: '99999',
        },
      };

      const { body } = await request(app.getHttpServer())
        .post(`/communes/91534/revisions`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ context })
        .expect(201);

      expect(body.codeCommune).toBe('91534');
      expect(body.client).toMatchObject({
        id: client.id,
        nom: 'test',
        mandataire: 'mandataire',
        chefDeFile: 'chefDeFile',
        chefDeFileEmail: 'chefDeFile@test.fr',
      });
      expect(body.status).toBe(StatusRevisionEnum.PENDING);
      expect(body.isReady).toBeFalsy();
      expect(body.validation).toEqual(null);
      expect(body.publishedAt).toBeNull();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
      expect(body.context).toMatchObject(context);
    });
  });

  describe('POST revisions/:revisionId/files/bal', () => {
    it('REVISION MIDDLEWARE BAD OBJECT ID', async () => {
      const client: Client2 = await createClient();

      await request(app.getHttpServer())
        .put(`/revisions/coucou/files/bal`)
        .set('authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 400,
          message: 'Revision Id coucou is not ObjectId',
        });
    });

    it('REVISION MIDDLEWARE BAD', async () => {
      const client: Client2 = await createClient();
      const id = new ObjectId().toHexString();
      await request(app.getHttpServer())
        .put(`/revisions/${id}/files/bal`)
        .set('authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 404,
          message: `Revision ${id} not found`,
        });
    });

    it('REVISION GUARD', async () => {
      const token1: string = generateToken();
      const token2: string = generateToken();
      const client: Client2 = await createClient({ token: token1 });
      const client2: Client2 = await createClient({ token: token2 });

      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('authorization', `Bearer ${client2.token}`)
        .expect({
          statusCode: 403,
          message: 'Vous n’êtes pas autorisé à accéder à cette révision',
        });
    });

    it('FILE GUARD NO FILE', async () => {
      const client: Client2 = await createClient();
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 404,
          message: 'Fichier non fourni.',
        });
    });

    it('FILE GUARD Content-Encoding', async () => {
      const client: Client2 = await createClient();
      const file = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .set('Content-Encoding', `gzip`)
        .send(file)
        .expect({
          statusCode: 400,
          message: 'Aucun encodage de contenue dans l’en-tête n’est accepté.',
        });
    });

    it('FILE GUARD Content-MD5', async () => {
      const client: Client2 = await createClient();
      const file = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .set('Content-MD5', `coucou`)
        .send(file)
        .expect({
          statusCode: 400,
          message:
            'La valeur de l’en-tête Content-MD5 ne correspond pas à la signature MD5 du contenu soumis.',
        });
    });

    it('REVISION ALREADY PUBLISHED', async () => {
      const client: Client2 = await createClient();
      const file = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file)
        .expect({
          statusCode: 412,
          message: 'La révision n’est plus modifiable',
        });
    });

    it('REVISION ALREADY FILE', async () => {
      const client: Client2 = await createClient();
      const file = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      await createFile({
        id: new ObjectId().toHexString(),
        revisionId: revision.id,
      });
      await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file)
        .expect({
          statusCode: 412,
          message: 'Fichier déjà attaché a la révision',
        });
    });

    it('ATTACH FILE', async () => {
      const client: Client2 = await createClient();
      const file = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      const fileId = new ObjectId().toHexString();
      jest
        .spyOn(s3Service, 'writeFile')
        .mockImplementation(async (buffer: Buffer) => {
          expect(buffer).toEqual(Buffer.from(file));
          return fileId;
        });

      const { body } = await request(app.getHttpServer())
        .put(`/revisions/${revision.id}/files/bal`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file);

      const expected = {
        id: fileId,
        revisionId: revision.id,
        type: 'bal',
      };
      expect(body).toMatchObject(expected);
    });
  });

  describe('POST revisions/:revisionId/compute', () => {
    it('COMPUTE REVISION ALREADY PUBLISHED', async () => {
      const client: Client2 = await createClient();
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 412,
          message: 'La révision n’est plus modifiable',
        });
    });

    it('COMPUTE REVISION NO FILE', async () => {
      const client: Client2 = await createClient();
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 404,
          message: `Aucun fichier de type 'bal' associé à la révision ${revision.id}`,
        });
    });

    it('COMPUTE REVISION BAD CODE INSEE', async () => {
      const client: Client2 = await createClient({
        isRelaxMode: true,
      });
      const fileData = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '91534',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      const file = await createFile({
        id: new ObjectId().toHexString(),
        revisionId: revision.id,
      });
      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toEqual(file.id);
          return fileData;
        });
      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file);
      expect(body.status).toBe(StatusRevisionEnum.PENDING);
      expect(body.validation.valid).toBeFalsy();
      expect(body.validation.errors).toEqual(
        expect.arrayContaining(['commune_insee.valeur_inattendue']),
      );
      expect(body.validation.warnings).toBeDefined();
      expect(body.validation.infos).toBeDefined();
      expect(body.validation.rowsCount).toBe(1);
    });

    it('COMPUTE REVISION OUT OF PERIMETER', async () => {
      const client: Client2 = await createClient({
        isRelaxMode: true,
      });
      const fileData = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      const file = await createFile({
        id: new ObjectId().toHexString(),
        revisionId: revision.id,
      });
      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toEqual(file.id);
          return fileData;
        });
      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file);
      expect(body.status).toBe(StatusRevisionEnum.PENDING);
      expect(body.validation.valid).toBeFalsy();
      expect(body.validation.errors).toEqual(
        expect.arrayContaining(['commune_insee.out_of_perimeter']),
      );
      expect(body.validation.warnings).toBeDefined();
      expect(body.validation.infos).toBeDefined();
      expect(body.validation.rowsCount).toBe(1);
    });

    it('COMPUTE REVISION OUT OF PERIMETER', async () => {
      const client: Client2 = await createClient({
        isRelaxMode: true,
      });
      const fileData = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      const file = await createFile({
        id: new ObjectId().toHexString(),
        revisionId: revision.id,
      });
      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toEqual(file.id);
          return fileData;
        });

      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file);
      expect(body.status).toBe(StatusRevisionEnum.PENDING);
      expect(body.validation.valid).toBeFalsy();
      expect(body.validation.errors).toEqual(
        expect.arrayContaining(['commune_insee.out_of_perimeter']),
      );
      expect(body.validation.warnings).toBeDefined();
      expect(body.validation.infos).toBeDefined();
      expect(body.validation.rowsCount).toBe(1);
    });

    it('COMPUTE REVISION', async () => {
      const client: Client2 = await createClient(
        {
          isRelaxMode: true,
        },
        {
          perimeters: [
            {
              type: TypePerimeterEnum.COMMUNE,
              code: '31591',
            },
          ],
        },
      );
      const fileData = readFile('1.3-valid.csv');
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
      });
      const file = await createFile({
        id: new ObjectId().toHexString(),
        revisionId: revision.id,
      });
      jest
        .spyOn(s3Service, 'getFile')
        .mockImplementation(async (fileId: string) => {
          expect(fileId).toEqual(file.id);
          return fileData;
        });

      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/compute`)
        .set('Authorization', `Bearer ${client.token}`)
        .send(file);
      expect(body.status).toBe(StatusRevisionEnum.PENDING);
      expect(body.validation.valid).toBeTruthy();
      expect(body.validation.errors.length).toBe(0);
      expect(body.validation.warnings).toBeDefined();
      expect(body.validation.infos).toBeDefined();
      expect(body.validation.rowsCount).toBe(1);
    });
  });

  describe('POST revisions/:revisionId/publish', () => {
    it('PUBLISH REVISION HABILITATION REQUIRED', async () => {
      const client: Client2 = await createClient({
        nom: 'test',
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 400,
          message: 'Le client test nécessite une habilitation pour publier',
        });
    });

    it('PUBLISH REVISION BAD HABILITATION', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const habilitationId = new ObjectId().toHexString();
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .send({ habilitationId })
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 404,
          message: `L’habilitation ${habilitationId} n’est pas valide`,
        });
    });

    it('PUBLISH REVISION HABILITATION NOT VALID', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const habilitation = await createHabilitation({
        status: StatusHabilitationEnum.PENDING,
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .send({ habilitationId: habilitation.id })
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 404,
          message: `L’habilitation ${habilitation.id} n’est pas valide`,
        });
    });

    it('PUBLISH REVISION NOT READY', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: false,
      });
      const expiresAt = add(new Date(), { years: 1 });
      const habilitation = await createHabilitation({
        status: StatusHabilitationEnum.ACCEPTED,
        expiresAt,
        codeCommune: '31591',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .send({ habilitationId: habilitation.id })
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 412,
          message: 'La publication n’est pas possible',
        });
    });

    it('PUBLISH REVISION ALREADY PUBLISHED', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isReady: false,
      });
      const expiresAt = add(new Date(), { years: 1 });
      const habilitation = await createHabilitation({
        status: StatusHabilitationEnum.ACCEPTED,
        expiresAt,
        codeCommune: '31591',
        clientId: client.id,
      });
      await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .send({ habilitationId: habilitation.id })
        .set('Authorization', `Bearer ${client.token}`)
        .expect({
          statusCode: 412,
          message: 'La publication n’est pas possible',
        });
    });

    it('PUBLISH REVISION FIRST PUBLISH', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.HABILITATION,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const expiresAt = add(new Date(), { years: 1 });
      const habilitation = await createHabilitation({
        status: StatusHabilitationEnum.ACCEPTED,
        expiresAt,
        codeCommune: '31591',
        clientId: client.id,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
        },
      });
      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .send({ habilitationId: habilitation.id })
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      expect(body.publishedAt).toBeDefined();
      expect(body.status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body.isCurrent).toBeTruthy();
      expect(body.isReady).toBeNull();
      expect(body.habilitation).toMatchObject({
        id: habilitation.id,
        codeCommune: '31591',
        expiresAt: expiresAt.toISOString(),
      });
    });

    it('PUBLISH REVISION WITHOUT HABILITATION', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.CHEF_DE_FILE,
      });
      const revision = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision.id}/publish`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);
      expect(body.publishedAt).toBeDefined();
      expect(body.status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body.isCurrent).toBeTruthy();
      expect(body.isReady).toBeNull();
    });

    it('PUBLISH REVISION MULTI REVISION', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.CHEF_DE_FILE,
      });
      const revision1 = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const { id: readyId } = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isCurrent: false,
        isReady: false,
      });
      const { id: currentId } = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PUBLISHED,
        isCurrent: true,
      });
      const { body } = await request(app.getHttpServer())
        .post(`/revisions/${revision1.id}/publish`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);
      expect(body.publishedAt).toBeDefined();
      expect(body.status).toBe(StatusRevisionEnum.PUBLISHED);
      expect(body.isCurrent).toBeTruthy();
      expect(body.isReady).toBeNull();

      const oldRevision = await revisionRepository.findOneBy({ id: currentId });
      expect(oldRevision.isCurrent).toBeFalsy();

      const readyRevision = await revisionRepository.findOneBy({ id: readyId });
      expect(readyRevision.isReady).toBeFalsy();
    });

    it('PUBLISH REVISION MULTI REVISION', async () => {
      const client: Client2 = await createClient({
        authorizationStrategy: AuthorizationStrategyEnum.CHEF_DE_FILE,
      });
      const revision1 = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });
      const revision2 = await createRevision({
        codeCommune: '31591',
        clientId: client.id,
        status: StatusRevisionEnum.PENDING,
        isReady: true,
      });

      revisionService.publishOneWithLock(revision1, client);

      await expect(
        revisionService.publishOneWithLock(revision2, client),
      ).rejects.toThrow(
        new HttpException(
          'La publication n’est pas possible car une publication est deja en cours',
          HttpStatus.PRECONDITION_FAILED,
        ),
      );
    });
  });
});
