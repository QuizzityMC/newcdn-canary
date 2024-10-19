-- AlterTable
ALTER TABLE "WaitingVerification" ADD COLUMN     "shouldCompress" BOOLEAN,
ALTER COLUMN "animated" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL;
