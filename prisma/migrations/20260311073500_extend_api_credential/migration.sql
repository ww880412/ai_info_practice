-- AlterTable
ALTER TABLE "ApiCredential" ADD COLUMN     "config" JSONB,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "validationError" TEXT;

-- CreateIndex
CREATE INDEX "ApiCredential_provider_isActive_isDefault_idx" ON "ApiCredential"("provider", "isActive", "isDefault");

-- CreateIndex
CREATE INDEX "ApiCredential_provider_isDefault_createdAt_idx" ON "ApiCredential"("provider", "isDefault", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_provider_name_isActive_key" ON "ApiCredential"("provider", "name", "isActive");
