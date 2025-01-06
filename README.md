# API de dépôt

L'api-depot est un système de versionning des BALs, c'est la ou sont centralisés tous les fichiers BALs.

## Documentation

https://adresse-data-gouv-fr.gitbook.io/bal/api-depot

## Pré-requis

- [Node.js](https://nodejs.org) 22
- [yarn](https://www.yarnpkg.com)
- [PostgresSQL](https://www.postgresql.org/)

## Utilisation

### Installation

Installation des dépendances Node.js

```bash
yarn
```

Produire le fichier `elus.json` qui permet d'identifier les élus via france connect

```bash
yarn habilitations:build-rne
```

Créer les variables d'environnement

```bash
cp .env.sample .env
```

On pourra ensuite éditer les variables d'environnement dans le fichier `.env` si nécessaire.

### Développement

Lancer l'api de développement :

```
$ yarn dev
```

### Production

Démarrer l'api (port 5000 par défaut) :

```
$ yarn start
```

### Test

Rapport des tests (jest) :

```
$ yarn test
```

### Linter

Rapport du linter (eslint) :

```
$ yarn lint
```

## Configuration

Cette application utilise des variables d'environnement pour sa configuration.
Elles peuvent être définies classiquement ou en créant un fichier `.env` sur la base du modèle `.env.sample`.

| Nom de la variable | Description                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `POSTGRES_URL`     | Paramètre de connexion à PostgresSql                                                               |
| ---                | ---                                                                                                |
| `PORT`             | Port à utiliser pour l'API                                                                         |
| `ADMIN_TOKEN`      | Token pour accéder au route protégé par Admin()                                                    |
| `DEMO_MODE`        | Si il est a 1 aucun mail n'est envoyé et le code de validation de habilitation par mail est 000000 |
| ---                | ---                                                                                                |
| `API_DEPOT_URL`    | URL de l'api-depot                                                                                 |
| `API_ANNURAIRE`    | URL de base de l’API des batiments publique                                                        |
| ---                | ---                                                                                                |
| `FC_SERVICE_URL`   | URL de base du service france connect                                                              |
| `FC_FS_ID`         | Id de l'application dans france connect                                                            |
| `FC_FS_SECRET`     | Secret de l'application dans france connect                                                        |
| `FC_FS_CALLBACK`   | Callback de l'application dans france connect                                                      |
| ---                | ---                                                                                                |
| `BAN_API_URL`      | URL de base de ban-plateforme                                                                      |
| `BAN_API_TOKEN`    | Token pour les requète vers ban-plateforme                                                         |
| `NOTIFY_BAN`       | Indique si une requète doit être lancer à ban-plateforme si une BAL est publiée (1)                |
| ---                | ---                                                                                                |
| `SMTP_HOST`        | Nom d'hôte du serveur SMTP                                                                         |
| `SMTP_PORT`        | Port du serveur SMTP                                                                               |
| `SMTP_USER`        | Nom d'utilisateur pour se connecter au serveur SMTP                                                |
| `SMTP_PASS`        | Mot de passe pour se connecter au serveur SMTP                                                     |
| `SMTP_SECURE`      | Indique si le serveur SMTP nécessite une connexion sécurisée (`YES`)                               |
| `SMTP_FROM`        | Adresse à utiliser en tant qu'expéditeur des emails                                                |
| `SMTP_BCC`         | Adresse(s) en copie cachée à utiliser pour tous les envois de notifications                        |
| ---                | ---                                                                                                |
| `S3_ENDPOINT`      | URL de base du serveur S3                                                                          |
| `S3_REGION`        | région du S3                                                                                       |
| `S3_CONTAINER_ID`  | Id du container S3                                                                                 |
| `S3_USER`          | User S3                                                                                            |
| `S3_ACCESS_KEY`    | Clef d'accès S3                                                                                    |
| `S3_SECRET_KEY`    | Clef secrete S3                                                                                    |
| `S3_DESCRIPTION`   |                                                                                                    |

Toutes ces variables ont des valeurs par défaut que vous trouverez dans le fichier `.env.sample`.
