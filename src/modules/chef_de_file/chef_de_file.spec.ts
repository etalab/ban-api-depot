import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { ObjectId } from 'bson';

import { ChefDeFileModule } from './chef_de_file.module';
import { ChefDeFile } from './chef_de_file.entity';
import { Perimeter, TypePerimeterEnum } from './perimeters.entity';
import { UpdateChefDeFileDTO } from './dto/update_chef_de_file.dto';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Client as Client2 } from '../client/client.entity';
import { Habilitation } from '../habilitation/habilitation.entity';
import { Revision } from '../revision/revision.entity';
import { File } from '../file/file.entity';
import { Mandataire } from '../mandataire/mandataire.entity';

process.env.FC_FS_ID = 'coucou';
process.env.ADMIN_TOKEN = 'xxxx';

describe('CHEF_DE_FILE MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
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
        ChefDeFileModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT REPOSITORY
    chefDeFileRepository = app.get(getRepositoryToken(ChefDeFile));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await chefDeFileRepository.delete({});
  });

  it('GET /chefs-de-file empty', async () => {
    const response = await request(app.getHttpServer())
      .get(`/chefs-de-file`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('POST /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .expect(403);
  });

  it('POST /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [
        {
          type: TypePerimeterEnum.COMMUNE,
          code: '00000',
        },
      ],
    };
    const response = await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);
    expect(response.body).toMatchObject(chef_de_file);
  });

  it('POST /chefs-de-file default', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    const response = await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const resExpected: Partial<ChefDeFile> = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: false,
      perimeters: [],
    };
    expect(response.body).toMatchObject(resExpected);
  });

  it('GET /chefs-de-file/:id', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    const response = await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response2 = await request(app.getHttpServer())
      .get(`/chefs-de-file/${response.body.id}`)
      .expect(200);

    expect(response2.body).toMatchObject(chef_de_file);
  });

  it('GET /chefs-de-file/:id 400', async () => {
    await request(app.getHttpServer()).get(`/chefs-de-file/coucou`).expect(400);
  });

  it('GET /chefs-de-file/:id 404', async () => {
    await request(app.getHttpServer())
      .get(`/chefs-de-file/${new ObjectId().toHexString()}`)
      .expect(404);
  });

  it('GET /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/chefs-de-file`)
      .expect(200);

    expect(response.body[0]).toMatchObject(chef_de_file);
  });

  it('GET /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response2 = await request(app.getHttpServer())
      .get(`/chefs-de-file`)
      .expect(200);

    expect(response2.body.length).toBe(3);
  });

  it('PUT /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    const response = await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateChefDeFileDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
      isEmailPublic: false,
      perimeters: [
        {
          type: TypePerimeterEnum.COMMUNE,
          code: '00000',
        },
      ],
    };

    const response3 = await request(app.getHttpServer())
      .put(`/chefs-de-file/${response.body.id}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(200);

    expect(response3.body).toMatchObject(change);

    const response4 = await request(app.getHttpServer())
      .get(`/chefs-de-file/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(change);
  });

  it('PUT 403 /chefs-de-file', async () => {
    const chef_de_file: UpdateChefDeFileDTO = {
      nom: 'test',
      email: 'test@test.fr',
      isEmailPublic: true,
      perimeters: [],
    };
    const response = await request(app.getHttpServer())
      .post(`/chefs-de-file`)
      .send(chef_de_file)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateChefDeFileDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
      isEmailPublic: false,
      perimeters: [
        {
          type: TypePerimeterEnum.COMMUNE,
          code: '00000',
        },
      ],
    };

    await request(app.getHttpServer())
      .put(`/chefs-de-file/${response.body.id}`)
      .send(change)
      .expect(403);

    const response4 = await request(app.getHttpServer())
      .get(`/chefs-de-file/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(chef_de_file);
  });

  it('PUT /chefs-de-file/:id 404', async () => {
    const change: UpdateChefDeFileDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
      isEmailPublic: false,
      perimeters: [
        {
          type: TypePerimeterEnum.COMMUNE,
          code: '00000',
        },
      ],
    };

    await request(app.getHttpServer())
      .put(`/chefs-de-file/coucou`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(400);
  });

  it('PUT /chefs-de-file/:id 404', async () => {
    const change: UpdateChefDeFileDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
      isEmailPublic: false,
      perimeters: [
        {
          type: TypePerimeterEnum.COMMUNE,
          code: '00000',
        },
      ],
    };

    await request(app.getHttpServer())
      .put(`/chefs-de-file/${new ObjectId().toHexString()}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(404);
  });
});
