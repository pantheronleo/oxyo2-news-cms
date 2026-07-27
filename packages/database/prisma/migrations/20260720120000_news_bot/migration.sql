-- CreateEnum
CREATE TYPE "NewsBotRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "NewsBotTrigger" AS ENUM ('SCHEDULED', 'MANUAL');
CREATE TYPE "NewsBotItemStatus" AS ENUM ('PENDING', 'CREATED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "NewsBotSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 120,
  "articleLimit" INTEGER,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsBotSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsBotSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "categoryId" TEXT,
  "credentialEnvKey" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsBotSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsBotRun" (
  "id" TEXT NOT NULL,
  "trigger" "NewsBotTrigger" NOT NULL,
  "status" "NewsBotRunStatus" NOT NULL DEFAULT 'QUEUED',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsBotRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsBotItem" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "sourcePublishedAt" TIMESTAMP(3),
  "status" "NewsBotItemStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sourceId" TEXT NOT NULL,
  "runId" TEXT,
  "contentId" TEXT,
  CONSTRAINT "NewsBotItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsBotSource_name_key" ON "NewsBotSource"("name");
CREATE INDEX "NewsBotSource_isEnabled_idx" ON "NewsBotSource"("isEnabled");
CREATE INDEX "NewsBotRun_status_createdAt_idx" ON "NewsBotRun"("status", "createdAt");
CREATE UNIQUE INDEX "NewsBotItem_sourceUrl_key" ON "NewsBotItem"("sourceUrl");
CREATE UNIQUE INDEX "NewsBotItem_contentId_key" ON "NewsBotItem"("contentId");
CREATE INDEX "NewsBotItem_sourceId_status_idx" ON "NewsBotItem"("sourceId", "status");

ALTER TABLE "NewsBotItem" ADD CONSTRAINT "NewsBotItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsBotSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsBotItem" ADD CONSTRAINT "NewsBotItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "NewsBotRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewsBotItem" ADD CONSTRAINT "NewsBotItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
