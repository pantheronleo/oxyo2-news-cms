-- CreateEnum
CREATE TYPE "NewsBotLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "NewsBotItem" ADD COLUMN "sourceExcerpt" TEXT;

-- CreateTable
CREATE TABLE "NewsBotLog" (
  "id" TEXT NOT NULL,
  "level" "NewsBotLogLevel" NOT NULL DEFAULT 'INFO',
  "stage" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "runId" TEXT NOT NULL,
  "sourceId" TEXT,
  "itemId" TEXT,
  CONSTRAINT "NewsBotLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsBotLog_runId_createdAt_idx" ON "NewsBotLog"("runId", "createdAt");
CREATE INDEX "NewsBotLog_itemId_createdAt_idx" ON "NewsBotLog"("itemId", "createdAt");

ALTER TABLE "NewsBotLog" ADD CONSTRAINT "NewsBotLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "NewsBotRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsBotLog" ADD CONSTRAINT "NewsBotLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsBotSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsBotLog" ADD CONSTRAINT "NewsBotLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NewsBotItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
