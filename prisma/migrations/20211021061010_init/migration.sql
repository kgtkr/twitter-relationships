-- CreateEnum
CREATE TYPE "DiffType" AS ENUM ('ADDITION', 'DELETION');

-- CreateEnum
CREATE TYPE "FFRecordType" AS ENUM ('FOLLOWER', 'FRIEND');

-- CreateTable
CREATE TABLE "ff_records" (
    "id" UUID NOT NULL,
    "user_id" CHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "type" "FFRecordType" NOT NULL,

    CONSTRAINT "pk_ff_records" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff_record_diffs" (
    "ff_record_id" UUID NOT NULL,
    "user_id" CHAR(20) NOT NULL,
    "type" "DiffType" NOT NULL,

    CONSTRAINT "pk_ff_record_diffs" PRIMARY KEY ("ff_record_id","user_id")
);

-- CreateTable
CREATE TABLE "user_records" (
    "id" CHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "json" JSONB NOT NULL,

    CONSTRAINT "pk_user_records" PRIMARY KEY ("id","created_at")
);

-- CreateIndex
CREATE INDEX "idx_ff_records_created_at" ON "ff_records"("created_at");

-- CreateIndex
CREATE INDEX "idx_ff_records_user_id" ON "ff_records"("user_id");

-- AddForeignKey
ALTER TABLE "ff_record_diffs" ADD CONSTRAINT "fk_ff_record_diffs_ff_record_id" FOREIGN KEY ("ff_record_id") REFERENCES "ff_records"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
