import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1700000000000 implements MigrationInterface {
  name = "InitSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TenantAccount
    await queryRunner.query(`
      CREATE TABLE "tenant_account" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountName" text NOT NULL,
        "creationDate" timestamptz DEFAULT now(),
        "regAddress" text,
        "officialEmail" text,
        "officialContactNumber" text,
        "email" text,
        "password" text
      );
    `);

    // Role
    await queryRunner.query(`
      CREATE TABLE "role" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "creationdate" timestamptz DEFAULT now(),
        "createdby" text
      );
    `);

    // AppUser
    await queryRunner.query(`
      CREATE TABLE "app_user" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "password" text NOT NULL,
        "userName" text,
        "contactDetails" text,
        "contactEmail" text,
        "creationdate" timestamptz DEFAULT now(),
        "createdby" text,
        "enabled" boolean DEFAULT true,
        "email" text NOT NULL,
        "role" text NOT NULL,
        "role_id" text,
        "tenant_id" uuid
      );
    `);

    // Permission
    await queryRunner.query(`
      CREATE TABLE "permission" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "access" text NOT NULL,
        "enabled" boolean DEFAULT false,
        "role_id" text NOT NULL
      );
    `);

    // AccountContact
    await queryRunner.query(`
      CREATE TABLE "account_contact" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contactType" text,
        "contactDetails" text,
        "contactName" text,
        "contactDesignation" text,
        "tenant_id" uuid
      );
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_app_user_tenant_id" ON "app_user" ("tenant_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_account_contact_tenant_id" ON "account_contact" ("tenant_id");`
    );

    // Foreign Keys
    await queryRunner.query(`
      ALTER TABLE "app_user"
      ADD CONSTRAINT "FK_app_user_role"
      FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE "app_user"
      ADD CONSTRAINT "FK_app_user_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE "permission"
      ADD CONSTRAINT "FK_permission_role"
      FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE "account_contact"
      ADD CONSTRAINT "FK_account_contact_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    // Unique constraints
    await queryRunner.query(`
      ALTER TABLE "permission"
      ADD CONSTRAINT "UQ_permission_role_access"
      UNIQUE ("role_id", "access");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "permission" DROP CONSTRAINT "UQ_permission_role_access";`);
    await queryRunner.query(`ALTER TABLE "account_contact" DROP CONSTRAINT "FK_account_contact_tenant";`);
    await queryRunner.query(`ALTER TABLE "permission" DROP CONSTRAINT "FK_permission_role";`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP CONSTRAINT "FK_app_user_tenant";`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP CONSTRAINT "FK_app_user_role";`);

    await queryRunner.query(`DROP INDEX "IDX_account_contact_tenant_id";`);
    await queryRunner.query(`DROP INDEX "IDX_app_user_tenant_id";`);

    await queryRunner.query(`DROP TABLE "account_contact";`);
    await queryRunner.query(`DROP TABLE "permission";`);
    await queryRunner.query(`DROP TABLE "app_user";`);
    await queryRunner.query(`DROP TABLE "role";`);
    await queryRunner.query(`DROP TABLE "tenant_account";`);
  }
}
