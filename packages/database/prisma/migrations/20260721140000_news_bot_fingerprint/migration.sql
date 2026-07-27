-- AlterTable
ALTER TABLE "NewsBotItem" ADD COLUMN "sourceFingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NewsBotItem_sourceFingerprint_key" ON "NewsBotItem"("sourceFingerprint");
