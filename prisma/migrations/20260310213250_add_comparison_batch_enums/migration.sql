-- CreateEnum
CREATE TYPE "ComparisonMode" AS ENUM ('TWO_STEP', 'TOOL_CALLING');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "ComparisonBatch" DROP COLUMN "targetMode",
ADD COLUMN     "sourceMode" "ComparisonMode",
ADD COLUMN     "targetMode" "ComparisonMode",
ADD COLUMN     "processedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "winRate" DOUBLE PRECISION,
ADD COLUMN     "avgScoreDiff" DOUBLE PRECISION,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "BatchStatus" USING (
  CASE "status"
    WHEN 'pending' THEN 'PENDING'::"BatchStatus"
    WHEN 'processing' THEN 'PROCESSING'::"BatchStatus"
    WHEN 'completed' THEN 'COMPLETED'::"BatchStatus"
    WHEN 'failed' THEN 'FAILED'::"BatchStatus"
    ELSE 'PENDING'::"BatchStatus"
  END
),
ALTER COLUMN "status" SET DEFAULT 'PENDING'::"BatchStatus";

-- CreateIndex
CREATE INDEX "ComparisonBatch_createdAt_id_idx" ON "ComparisonBatch"("createdAt", "id");
