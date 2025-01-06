import { deburr, groupBy } from 'lodash';
import { UserFranceConnect } from '../types/user_france_connect.type';
import { readFileSync } from 'fs';
import { join } from 'path';

import { Elu } from '@/lib/types/elu.type';

let elusJson: Elu[] = [];

try {
  elusJson = JSON.parse(
    readFileSync(join(__dirname, '../../../', 'elus.json'), 'utf-8'),
  );
} catch {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('elus.json must be defined in production mode');
  }
}

const elusByBirthdate: Record<string, Elu[]> = groupBy(
  elusJson,
  'dateNaissance',
);

function normalize(str) {
  return deburr(str)
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ');
}

export function getElu(user: UserFranceConnect): Elu | undefined {
  const nNomNaissance: string = normalize(user.family_name);
  const nPrenom: string = normalize(user.given_name);
  const sexe: 'M' | 'F' = user.gender === 'male' ? 'M' : 'F';
  const elu: Elu = (elusByBirthdate[user.birthdate] || []).find(
    (e: Elu) =>
      e.sexe === sexe &&
      normalize(e.nomNaissance) === nNomNaissance &&
      nPrenom.startsWith(normalize(e.prenom)),
  );

  return elu;
}
