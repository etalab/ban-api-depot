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
import { MailerService } from '@nestjs-modules/mailer';

import { Client as Client2 } from './client.entity';
import { ClientModule } from './client.module';
import { UpdateClientDTO } from './dto/update_client.dto';
import { Mandataire } from '../mandataire/mandataire.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { TOKEN_LENGTH } from '@/lib/utils/token.utils';
import { Perimeter } from '../chef_de_file/perimeters.entity';
import { Habilitation } from '../habilitation/habilitation.entity';
import { Revision } from '../revision/revision.entity';
import { File } from '../file/file.entity';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
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

describe('CLIENT MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let clientRepository: Repository<Client2>;
  let mandataireRepository: Repository<Mandataire>;
  let chefDeFileRepository: Repository<ChefDeFile>;

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
        ClientModule,
        MailerModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT MODEL
    clientRepository = app.get(getRepositoryToken(Client2));
    mandataireRepository = app.get(getRepositoryToken(Mandataire));
    chefDeFileRepository = app.get(getRepositoryToken(ChefDeFile));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await clientRepository.delete({});
    await mandataireRepository.delete({});
    await chefDeFileRepository.delete({});
  });

  async function getClient(props: UpdateClientDTO): Promise<UpdateClientDTO> {
    const mandataireToSave = mandataireRepository.create({
      nom: 'mandataire',
      email: 'mandataire@test.com',
    });
    const mandataire = await mandataireRepository.save(mandataireToSave);
    const chefDeFileToSave = chefDeFileRepository.create({
      nom: 'chefDeFile',
      email: 'chefDeFile@test.com',
    });
    const chefDeFile = await chefDeFileRepository.save(chefDeFileToSave);
    return {
      ...props,
      mandataireId: mandataire.id,
      chefDeFileId: chefDeFile.id,
    };
  }

  it('GET /clients empty', async () => {
    const response = await request(app.getHttpServer())
      .get(`/clients`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('POST /clients 403', async () => {
    const client = await getClient({
      nom: 'client_test',
    });
    await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .expect(403);
  });

  it('POST /clients 400', async () => {
    const client = await getClient({
      nom: 'client_test',
    });
    const response = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(400);

    expect(response.body.error).toBe('Bad Request');
  });

  it('POST /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    const response = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    expect(response.body).toMatchObject(client);
    expect(response.body.token).toHaveLength(TOKEN_LENGTH);
  });

  it('POST /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
    });
    const response = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    expect(response.body.token).toHaveLength(TOKEN_LENGTH);
    expect(response.body).toMatchObject({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
  });

  it('GET /clients/:id', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    const { body }: { body: Client } = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const { body: clientResponse }: { body: Client } = await request(
      app.getHttpServer(),
    )
      .get(`/clients/${body.id}`)
      .expect(200);

    expect(clientResponse).toMatchObject(client);
  });

  it('GET /clients/:id 400', async () => {
    await request(app.getHttpServer()).get(`/clients/coucou`).expect(400);
  });

  it('GET /clients/:id 404', async () => {
    await request(app.getHttpServer())
      .get(`/clients/${new ObjectId().toHexString()}`)
      .expect(404);
  });

  it('GET /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const { body: clientResponses }: { body: Client[] } = await request(
      app.getHttpServer(),
    )
      .get(`/clients`)
      .expect(200);

    expect(clientResponses[0]).toMatchObject(client);
  });

  it('GET /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response2 = await request(app.getHttpServer())
      .get(`/clients`)
      .expect(200);

    expect(response2.body.length).toBe(3);
  });

  it('PUT /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    const response = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateClientDTO = {
      nom: 'put_test',
      isActive: true,
      isRelaxMode: true,
    };

    const response3 = await request(app.getHttpServer())
      .put(`/clients/${response.body.id}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(200);

    expect(response3.body).toMatchObject(change);

    const response4 = await request(app.getHttpServer())
      .get(`/clients/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(change);
  });

  it('PUT 403 /clients', async () => {
    const client = await getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });
    const response = await request(app.getHttpServer())
      .post(`/clients`)
      .send(client)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateClientDTO = {
      nom: 'put_test',
      isActive: true,
      isRelaxMode: true,
    };

    await request(app.getHttpServer())
      .put(`/clients/${response.body.id}`)
      .send(change)
      .expect(403);

    const response4 = await request(app.getHttpServer())
      .get(`/clients/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(client);
  });

  it('PUT /clients/:id 400', async () => {
    const change = getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });

    await request(app.getHttpServer())
      .put(`/clients/coucou`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(400);
  });

  it('PUT /clients/:id 404', async () => {
    const change = getClient({
      nom: 'client_test',
      isActive: false,
      isRelaxMode: true,
    });

    await request(app.getHttpServer())
      .put(`/clients/${new ObjectId().toHexString()}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(404);
  });
});
