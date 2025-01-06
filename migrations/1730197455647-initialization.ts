import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initialization1730197455647 implements MigrationInterface {
  name = 'Initialization1730197455647';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "mandataires" ("id" character varying(24) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "nom" text NOT NULL, "email" text NOT NULL, CONSTRAINT "PK_3fae2a952f84a1d7a80b240be55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."perimeters_type_enum" AS ENUM('commune', 'departement', 'epci')`,
    );
    await queryRunner.query(
      `CREATE TABLE "perimeters" ("id" character varying(24) NOT NULL, "chef_de_file_id" character varying(24) NOT NULL, "type" "public"."perimeters_type_enum" NOT NULL, "code" text NOT NULL, CONSTRAINT "PK_812f0b99b15bb4dbab4e807b24d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_perimeters_chef_de_file_id" ON "perimeters" ("chef_de_file_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chefs_de_file" ("id" character varying(24) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "nom" text NOT NULL, "email" text NOT NULL, "is_email_public" boolean DEFAULT false, "is_signataire_charte" boolean DEFAULT false, CONSTRAINT "PK_af5269d8a8b4362ff9b3816f307" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."status_habilitation_enum" AS ENUM('accepted', 'pending', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "habilitations" ("id" character varying(24) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "client_id" character varying(24) NOT NULL, "code_commune" text, "email_commune" text, "franceconnect_authentication_url" text, "status" "public"."status_habilitation_enum" NOT NULL, "strategy" jsonb, "expires_at" TIMESTAMP, "accepted_at" TIMESTAMP, "rejected_at" TIMESTAMP, CONSTRAINT "PK_6c56ce7245081fdf164ccf99a17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_habilitation_client_id" ON "habilitations" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."authorization_strategy_enum" AS ENUM('internal', 'chef-de-file', 'habilitation')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clients" ("id" character varying(24) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "mandataire_id" character varying(24) NOT NULL, "chef_de_file_id" character varying(24), "legacy_id" text, "nom" text NOT NULL, "is_active" boolean DEFAULT true, "is_relax_mode" boolean DEFAULT true, "token" character varying(32) NOT NULL, "authorization_strategy" "public"."authorization_strategy_enum" NOT NULL, CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_client_mandataire_id" ON "clients" ("mandataire_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_client_chef_de_file_id" ON "clients" ("chef_de_file_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."status_revision_enum" AS ENUM('pending', 'published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "revisions" ("id" character varying(24) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "client_id" character varying(24) NOT NULL, "code_commune" text, "is_ready" boolean DEFAULT false, "is_current" boolean NOT NULL DEFAULT false, "status" "public"."status_revision_enum" NOT NULL DEFAULT 'pending', "context" jsonb, "validation" jsonb, "habilitation" jsonb, "published_at" TIMESTAMP, CONSTRAINT "PK_4aa9ee2c71c50508c3c501573c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revision_client_id" ON "revisions" ("client_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."type_file_enum" AS ENUM('bal')`,
    );
    await queryRunner.query(
      `CREATE TABLE "files" ("id" character varying(24) NOT NULL, "revision_id" character varying(24) NOT NULL, "size" integer, "hash" text NOT NULL DEFAULT false, "type" "public"."type_file_enum" NOT NULL DEFAULT 'bal', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_file_revision_id" ON "files" ("revision_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "perimeters" ADD CONSTRAINT "FK_6bb593e4bd2ad72bb828c780242" FOREIGN KEY ("chef_de_file_id") REFERENCES "chefs_de_file"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "habilitations" ADD CONSTRAINT "FK_6b5c25b97c43922cdbb607c932d" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "FK_1df50e81fdcde42a6964984f5cd" FOREIGN KEY ("mandataire_id") REFERENCES "mandataires"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "FK_d63159bac4a2242880ffee99977" FOREIGN KEY ("chef_de_file_id") REFERENCES "chefs_de_file"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisions" ADD CONSTRAINT "FK_761528b799edce9dd0e76a2526d" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" ADD CONSTRAINT "FK_d2005f96ea67d90fc7d24f17b12" FOREIGN KEY ("revision_id") REFERENCES "revisions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "files" DROP CONSTRAINT "FK_d2005f96ea67d90fc7d24f17b12"`,
    );
    await queryRunner.query(
      `ALTER TABLE "revisions" DROP CONSTRAINT "FK_761528b799edce9dd0e76a2526d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT "FK_d63159bac4a2242880ffee99977"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT "FK_1df50e81fdcde42a6964984f5cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "habilitations" DROP CONSTRAINT "FK_6b5c25b97c43922cdbb607c932d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "perimeters" DROP CONSTRAINT "FK_6bb593e4bd2ad72bb828c780242"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_file_revision_id"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP TYPE "public"."type_file_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_revision_client_id"`);
    await queryRunner.query(`DROP TABLE "revisions"`);
    await queryRunner.query(`DROP TYPE "public"."status_revision_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_client_chef_de_file_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_client_mandataire_id"`);
    await queryRunner.query(`DROP TABLE "clients"`);
    await queryRunner.query(`DROP TYPE "public"."authorization_strategy_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_habilitation_client_id"`);
    await queryRunner.query(`DROP TABLE "habilitations"`);
    await queryRunner.query(`DROP TYPE "public"."status_habilitation_enum"`);
    await queryRunner.query(`DROP TABLE "chefs_de_file"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_perimeters_chef_de_file_id"`,
    );
    await queryRunner.query(`DROP TABLE "perimeters"`);
    await queryRunner.query(`DROP TYPE "public"."perimeters_type_enum"`);
    await queryRunner.query(`DROP TABLE "mandataires"`);
  }
}
