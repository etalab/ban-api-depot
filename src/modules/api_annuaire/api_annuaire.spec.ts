import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import { ApiAnnuaireModule } from './api_annuaire.module';
import { ApiAnnuaireService } from './api_annuaire.service';

describe('API ANNUAIRE MODULE', () => {
  let app: INestApplication;
  let apiAnnuaireService: ApiAnnuaireService;
  const axiosMock = new MockAdapter(axios);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiAnnuaireModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    apiAnnuaireService = app.get<ApiAnnuaireService>(ApiAnnuaireService);
  });

  afterAll(async () => {
    await app.close();
    jest.clearAllMocks();
    axiosMock.reset();
  });

  describe('getEmailCommune', () => {
    it('getEmailCommune multi mairie', async () => {
      const codeCommune = '91400';

      // MOCK AXIOS
      const data: any = {
        results: [
          {
            nom: 'mairie principal',
            adresse_courriel: 'ok@test.fr',
          },
          {
            nom: 'mairie deleguee',
            adresse_courriel: 'ok2@test.fr;ok3@test.fr',
          },
        ],
      };
      axiosMock
        .onGet(
          `/catalog/datasets/api-lannuaire-administration/records?where=pivot%20LIKE%20"mairie"%20AND%20code_insee_commune="${codeCommune}"&limit=100`,
        )
        .reply(200, data);

      const emails = await apiAnnuaireService.getEmailsCommune(codeCommune);
      expect(emails).toEqual(['ok@test.fr', 'ok2@test.fr', 'ok3@test.fr']);
    });

    it('getEmailCommune only mairie deleguee', async () => {
      const codeCommune = '91400';

      // MOCK AXIOS
      const data: any = {
        results: [
          {
            nom: 'mairie deleguee',
            adresse_courriel: 'ok@ok.fr',
          },
        ],
      };
      axiosMock
        .onGet(
          `/catalog/datasets/api-lannuaire-administration/records?where=pivot%20LIKE%20"mairie"%20AND%20code_insee_commune="${codeCommune}"&limit=100`,
        )
        .reply(200, data);

      const email = await apiAnnuaireService.getEmailsCommune(codeCommune);

      expect(email).toEqual(['ok@ok.fr']);
    });

    it('getEmailCommune multi email', async () => {
      const codeCommune = '91400';

      // MOCK AXIOS
      const data: any = {
        results: [
          {
            nom: 'mairie principal',
            adresse_courriel: 'ok',
          },
        ],
      };
      axiosMock
        .onGet(
          `/catalog/datasets/api-lannuaire-administration/records?where=pivot%20LIKE%20"mairie"%20AND%20code_insee_commune="${codeCommune}"&limit=100`,
        )
        .reply(200, data);

      const email = await apiAnnuaireService.getEmailsCommune(codeCommune);
      expect(email).toBeUndefined();
    });

    it('getEmailCommune multi email', async () => {
      const codeCommune = '91400';
      const email = await apiAnnuaireService.getEmailsCommune(codeCommune);
      expect(email).toBeUndefined();
    });
  });
});
