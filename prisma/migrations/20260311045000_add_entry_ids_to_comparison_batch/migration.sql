-- AlterTable
ALTER TABLE "ComparisonBatch" ADD COLUMN "entryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
