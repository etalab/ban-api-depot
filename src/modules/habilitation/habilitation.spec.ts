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
import { add, sub } from 'date-fns';
import axios from 'axios';
import { omit } from 'lodash';

import {
  Habilitation,
  StatusHabilitationEnum,
  TypeStrategyEnum,
} from './habilitation.entity';
import {
  AuthorizationStrategyEnum,
  Client as Client2,
} from '../client/client.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { Mandataire } from '../mandataire/mandataire.entity';
import { HabilitationModule } from './habilitation.module';
import { MailerService } from '@nestjs-modules/mailer';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Revision } from '../revision/revision.entity';
import { Perimeter } from '../chef_de_file/perimeters.entity';
import { File } from '../file/file.entity';
import { Repository } from 'typeorm';
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

describe('HABILITATION MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let mandataireRepository: Repository<Mandataire>;
  let clientRepository: Repository<Client2>;
  let chefDeFileRepository: Repository<ChefDeFile>;
  let habilitationRepository: Repository<Habilitation>;

  const axiosMock = new MockAdapter(axios);

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
        HabilitationModule,
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

  async function createHabilitation(
    props: Partial<Habilitation>,
  ): Promise<Habilitation> {
    const client = await createClient();
    const entityToSave: Habilitation = habilitationRepository.create({
      clientId: client.id,
      ...props,
    });
    return habilitationRepository.save(entityToSave);
  }

  describe('CLIENT GUARD', () => {
    it('COMMUNE MIDLEWARE BAD', async () => {
      const client: Client2 = await createClient();
      await request(app.getHttpServer())
        .post(`/communes/91400/habilitations`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(404);
    });
  });

  describe('CLIENT GUARD NO TOKEN', () => {
    it('CLIENT GUARD NO TOKEN', async () => {
      await request(app.getHttpServer())
        .post(`/communes/91534/habilitations`)
        .expect(401);
    });

    it('CLIENT GUARD BAD TOKEN', async () => {
      await request(app.getHttpServer())
        .post(`/communes/91534/habilitations`)
        .set('authorization', `Bearer xxxx`)
        .expect(401);
    });

    it('CLIENT GUARD INACTIVE', async () => {
      const client: Client2 = await createClient({ isActive: false });
      await request(app.getHttpServer())
        .post(`/communes/91534/habilitations`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(403);
    });
  });

  describe('POST /communes/:codeCommune/habilitations', () => {
    it('CREATED NO EMAIL', async () => {
      const client: Client2 = await createClient();
      const { body } = await request(app.getHttpServer())
        .post(`/communes/91534/habilitations`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(201);

      const hab = {
        codeCommune: '91534',
        strategy: null,
        expiresAt: null,
        clientId: client.id,
        status: StatusHabilitationEnum.PENDING,
      };

      expect(body).toMatchObject(hab);
    });

    it('CREATED WITH EMAIL', async () => {
      const client: Client2 = await createClient();
      const codeCommune: string = '91534';
      // MOCK AXIOS
      const data: any = {
        results: [
          {
            nom: 'mairie principal',
            adresse_courriel: 'saclay@test.fr',
          },
          {
            nom: 'mairie Déléguée',
            adresse_courriel: 'saclay2@test.fr',
          },
        ],
      };
      axiosMock
        .onGet(
          `/catalog/datasets/api-lannuaire-administration/records?where=pivot%20LIKE%20"mairie"%20AND%20code_insee_commune="${codeCommune}"&limit=100`,
        )
        .reply(200, data);

      const { body } = await request(app.getHttpServer())
        .post(`/communes/${codeCommune}/habilitations`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(201);

      const hab = {
        codeCommune,
        emailsCommune: ['saclay@test.fr', 'saclay2@test.fr'],
        strategy: null,
        expiresAt: null,
        clientId: client.id,
        status: StatusHabilitationEnum.PENDING,
      };

      expect(body).toMatchObject(hab);
    });
  });

  describe('GET /habilitations/:habilitationId', () => {
    it('HABILITATION MIDLEWARE NO OBJECT ID', async () => {
      await request(app.getHttpServer())
        .get(`/habilitations/coucou`)
        .expect(400);
    });

    it('HABILITATION MIDLEWARE BAD HABILITATION ID', async () => {
      await request(app.getHttpServer())
        .get(`/habilitations/${new ObjectId().toHexString()}`)
        .expect(404);
    });

    it('GET /habilitations/:habilitationId', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        clientId: client.id,
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCode: '00000',
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .get(`/habilitations/${id}`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(200);

      const res = {
        ...omit(habilitation, 'strategy.pinCode'),
        client: {
          id: client.id,
          nom: 'test',
          mandataire: 'mandataire',
          chefDeFile: 'chefDeFile',
          chefDeFileEmail: 'chefDeFile@test.fr',
        },
      };
      expect(body).toMatchObject(res);
    });
  });

  describe('PUT /habilitations/:habilitationId/validate', () => {
    it('ADMIN GUARD NO TOKEN', async () => {
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCode: '00000',
        },
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .put(`/habilitations/${id}/validate`)
        .expect(403);
    });

    it('ADMIN GUARD TOKEN', async () => {
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCode: '00000',
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .put(`/habilitations/${id}/validate`)
        .set('authorization', `Token ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(body.expiresAt).toBeDefined();
      expect(body.expiresAt).not.toBeNull();
      expect(body.acceptedAt).toBeDefined();
      expect(body.acceptedAt).not.toBeNull();
      expect(body.status).toBe(StatusHabilitationEnum.ACCEPTED);
      expect(body.strategy.type).toBe(TypeStrategyEnum.INTERNAL);
    });

    it('ADMIN GUARD BEARER AND CHECK VALIDATE', async () => {
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCode: '00000',
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .put(`/habilitations/${id}/validate`)
        .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(body.expiresAt).toBeDefined();
      expect(body.expiresAt).not.toBeNull();
      expect(body.acceptedAt).toBeDefined();
      expect(body.acceptedAt).not.toBeNull();
      expect(body.status).toBe(StatusHabilitationEnum.ACCEPTED);
      expect(body.strategy.type).toBe(TypeStrategyEnum.INTERNAL);
    });
  });

  describe('POST /habilitations/:habilitationId/authentication/email/send-pin-code', () => {
    it('SEND CODE PIN ALREADY ACCEPETED', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.ACCEPTED,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/send-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(412);
    });

    it('SEND CODE PIN ALREADY REJECTED', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.REJECTED,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/send-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(412);
    });

    it('SEND CODE PIN NO EMAIL', async () => {
      const client: Client2 = await createClient();
      const habilitation = {
        codeCommune: '94000',
        status: StatusHabilitationEnum.PENDING,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/send-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(412);
    });

    it('SEND CODE PIN ALREADY SEND', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          createdAt: new Date(),
        },
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/send-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(409);
    });

    it('SEND CODE PIN ALREADY SEND', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '91534',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/send-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .expect(200);
    });
  });

  describe('POST /habilitations/:habilitationId/authentication/email/validate-pin-code', () => {
    it('VALIDATE CODE PIN ALREADY ACCEPETED', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.ACCEPTED,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '0000' })
        .expect(412);
    });

    it('VALIDATE CODE PIN ALREADY ACCEPETED', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.REJECTED,
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '0000' })
        .expect(412);
    });

    it('VALIDATE CODE PIN BAD CODE', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCodeExpiration: add(new Date(), { years: 1 }),
          pinCode: '0000',
          createdAt: new Date('2024-05-27T09:19:07.770Z'),
          remainingAttempts: 0,
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '1111' })
        .expect(412);

      expect(body).toMatchObject({
        statusCode: 412,
        message: 'Code non valide. Demande rejetée.',
      });
      const afterHabilitation = await habilitationRepository.findOneBy({ id });
      expect(afterHabilitation.rejectedAt).toBeDefined();
      expect(afterHabilitation.strategy).toMatchObject({
        type: 'email',
        authenticationError: 'Trop de tentative de code raté',
      });
      expect(afterHabilitation.status).toBe(StatusHabilitationEnum.REJECTED);
      expect(afterHabilitation.acceptedAt).toBeNull();
      expect(afterHabilitation.expiresAt).toBeNull();
    });

    it('VALIDATE CODE PIN BAD CODE', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCodeExpiration: add(new Date(), { years: 1 }),
          pinCode: '0000',
          createdAt: new Date('2024-05-27T09:19:07.770Z'),
          remainingAttempts: 10,
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '1111' })
        .expect(412);

      expect(body).toMatchObject({
        statusCode: 412,
        message: 'Code non valide, 9 tentatives restantes',
      });

      const afterHabilitation = await habilitationRepository.findOneBy({ id });
      expect(afterHabilitation.status).toBe(StatusHabilitationEnum.PENDING);
      expect(afterHabilitation.acceptedAt).toBeNull();
      expect(afterHabilitation.expiresAt).toBeNull();
    });

    it('VALIDATE CODE PIN DATE EXPIRE', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCodeExpiration: sub(new Date(), { years: 1 }),
          pinCode: '0000',
          createdAt: new Date('2024-05-27T09:19:07.770Z'),
          remainingAttempts: 10,
        },
      };

      const { id } = await createHabilitation(habilitation);

      const { body } = await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '0000' })
        .expect(412);

      expect(body).toMatchObject({
        statusCode: 412,
        message: 'Code expiré',
      });

      const afterHabilitation = await habilitationRepository.findOneBy({ id });
      expect(afterHabilitation.status).toBe(StatusHabilitationEnum.PENDING);
      expect(afterHabilitation.acceptedAt).toBeNull();
      expect(afterHabilitation.expiresAt).toBeNull();
    });

    it('VALIDATE CODE PIN', async () => {
      const client: Client2 = await createClient();
      const habilitation: Partial<Habilitation> = {
        codeCommune: '94000',
        emailsCommune: ['test@test.fr'],
        status: StatusHabilitationEnum.PENDING,
        strategy: {
          type: TypeStrategyEnum.EMAIL,
          pinCodeExpiration: add(new Date(), { years: 1 }),
          pinCode: '0000',
          createdAt: new Date('2024-05-27T09:19:07.770Z'),
          remainingAttempts: 10,
        },
      };

      const { id } = await createHabilitation(habilitation);

      await request(app.getHttpServer())
        .post(`/habilitations/${id}/authentication/email/validate-pin-code`)
        .set('authorization', `Bearer ${client.token}`)
        .send({ code: '0000' })
        .expect(200);

      const afterHabilitation = await habilitationRepository.findOneBy({ id });
      expect(afterHabilitation.status).toBe(StatusHabilitationEnum.ACCEPTED);
      expect(afterHabilitation.acceptedAt).toBeDefined();
      expect(afterHabilitation.expiresAt).toBeDefined();
    });
  });
});
