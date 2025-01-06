import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexIsCurrent1730368239908 implements MigrationInterface {
  name = 'IndexIsCurrent1730368239908';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_revision_is_current" ON "revisions" ("is_current") WHERE is_current IS TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_revision_is_current"`);
  }
}
