import { keyBy, groupBy } from 'lodash';
import * as communes from '@etalab/decoupage-administratif/data/communes.json';
import * as departements from '@etalab/decoupage-administratif/data/departements.json';
import * as epci from '@etalab/decoupage-administratif/data/epci.json';

import { CommuneCOG, DepartementCOG, EpciCOG } from '@/lib/types/cog.type';

const filteredCommunes: CommuneCOG[] = (communes as CommuneCOG[]).filter(
  ({ type }) => ['commune-actuelle', 'arrondissement-municipal'].includes(type),
);

const communesIndex: Record<string, CommuneCOG> = keyBy(
  filteredCommunes,
  'code',
);

const departementsIndex: Record<string, DepartementCOG> = keyBy(
  departements,
  'code',
);

const epciIndex: Record<string, EpciCOG> = keyBy(epci, 'code');

const communesByDepartementIndex: Record<string, CommuneCOG[]> = groupBy(
  communes,
  'departement',
);

export function isCommune(codeCommune: string): boolean {
  return Boolean(communesIndex[codeCommune]);
}

export function getCommune(codeCommune: string): CommuneCOG {
  return communesIndex[codeCommune];
}

export function getCommunesByDepartement(
  codeDepartement: string,
): CommuneCOG[] {
  return communesByDepartementIndex[codeDepartement] || [];
}

export function getDepartement(codeDepartement: string): DepartementCOG {
  return departementsIndex[codeDepartement];
}

export function getEPCI(siren: string): EpciCOG {
  return epciIndex[siren];
}

export function isArrondissement(codeArrondissement: string): boolean {
  const arr = communesIndex[codeArrondissement];
  return arr && arr.type === 'arrondissement-municipal';
}
