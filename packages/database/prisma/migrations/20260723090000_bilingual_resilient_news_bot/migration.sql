CREATE TYPE "ContentLanguage" AS ENUM ('ZH_CN', 'EN');

ALTER TABLE "Content" ADD COLUMN "visualNeedsReview" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ContentTranslation" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "language" "ContentLanguage" NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL DEFAULT '',
  "markdown" TEXT NOT NULL DEFAULT '',
  "html" TEXT NOT NULL DEFAULT '',
  "wordCount" INTEGER NOT NULL DEFAULT 0,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentTranslation_contentId_language_key" ON "ContentTranslation"("contentId", "language");
CREATE INDEX "ContentTranslation_language_idx" ON "ContentTranslation"("language");
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NewsBotSource" ADD COLUMN "allowsSourceImageReference" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceImagePermissionUrl" TEXT;
ALTER TABLE "NewsBotItem" ADD COLUMN "sourceImageUrl" TEXT,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailureAt" TIMESTAMP(3);
ALTER TABLE "Media" ADD COLUMN "provider" TEXT,
ADD COLUMN "providerAssetId" TEXT,
ADD COLUMN "attributionName" TEXT,
ADD COLUMN "attributionUrl" TEXT,
ADD COLUMN "license" TEXT,
ADD COLUMN "visualOrigin" TEXT;
