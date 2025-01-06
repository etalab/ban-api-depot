import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { Mandataire } from './mandataire.entity';
import { MandataireModule } from './mandataire.module';
import { UpdateMandataireDTO } from './dto/update_mandataire.dto';
import { Revision } from '../revision/revision.entity';
import { Habilitation } from '../habilitation/habilitation.entity';
import { Perimeter } from '../chef_de_file/perimeters.entity';
import { ChefDeFile } from '../chef_de_file/chef_de_file.entity';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Client as Client2 } from '../client/client.entity';
import { Repository } from 'typeorm';
import { ObjectId } from 'bson';
import { File } from '../file/file.entity';

process.env.FC_FS_ID = 'coucou';
process.env.ADMIN_TOKEN = 'xxxx';

describe('MANDATAIRE MODULE', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let mandataireRepository: Repository<Mandataire>;

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
        MandataireModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT MODEL
    mandataireRepository = app.get(getRepositoryToken(Mandataire));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await mandataireRepository.delete({});
  });

  it('GET /mandataires empty', async () => {
    const response = await request(app.getHttpServer())
      .get(`/mandataires`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('POST /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .expect(403);
  });

  it('POST /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    const response = await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);
    expect(response.body).toMatchObject(mandataire);
  });

  it('GET /mandataires/:id', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    const response = await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response2 = await request(app.getHttpServer())
      .get(`/mandataires/${response.body.id}`)
      .expect(200);

    expect(response2.body).toMatchObject(mandataire);
  });

  it('GET /mandataires/:id 400', async () => {
    await request(app.getHttpServer()).get(`/mandataires/coucou`).expect(400);
  });

  it('GET /mandataires/:id 404', async () => {
    await request(app.getHttpServer())
      .get(`/mandataires/${new ObjectId().toHexString()}`)
      .expect(404);
  });

  it('GET /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/mandataires`)
      .expect(200);

    expect(response.body[0]).toMatchObject(mandataire);
  });

  it('GET /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const response2 = await request(app.getHttpServer())
      .get(`/mandataires`)
      .expect(200);

    expect(response2.body.length).toBe(3);
  });

  it('PUT /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    const response = await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateMandataireDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
    };

    const response3 = await request(app.getHttpServer())
      .put(`/mandataires/${response.body.id}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(200);

    expect(response3.body).toMatchObject(change);

    const response4 = await request(app.getHttpServer())
      .get(`/mandataires/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(change);
  });

  it('PUT 403 /mandataires', async () => {
    const mandataire: UpdateMandataireDTO = {
      nom: 'test',
      email: 'test@test.fr',
    };
    const response = await request(app.getHttpServer())
      .post(`/mandataires`)
      .send(mandataire)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .expect(200);

    const change: UpdateMandataireDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
    };

    await request(app.getHttpServer())
      .put(`/mandataires/${response.body.id}`)
      .send(change)
      .expect(403);

    const response4 = await request(app.getHttpServer())
      .get(`/mandataires/${response.body.id}`)
      .expect(200);

    expect(response4.body).toMatchObject(mandataire);
  });

  it('PUT /mandataires/:id 404', async () => {
    const change: UpdateMandataireDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
    };

    await request(app.getHttpServer())
      .put(`/mandataires/coucou`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(400);
  });

  it('PUT /mandataires/:id 404', async () => {
    const change: UpdateMandataireDTO = {
      nom: 'nom',
      email: 'nom@test.fr',
    };

    await request(app.getHttpServer())
      .put(`/mandataires/${new ObjectId().toHexString()}`)
      .set('authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
      .send(change)
      .expect(404);
  });
});
