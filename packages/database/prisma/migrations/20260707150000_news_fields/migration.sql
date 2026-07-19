ALTER TABLE "Content" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General';
ALTER TABLE "Content" ADD COLUMN "authorName" TEXT NOT NULL DEFAULT 'Editorial Desk';
ALTER TABLE "Content" ADD COLUMN "sourceLabel" TEXT;
ALTER TABLE "Content" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Content_type_category_status_publishedAt_idx" ON "Content"("type", "category", "status", "publishedAt");
CREATE INDEX "Content_type_isFeatured_status_publishedAt_idx" ON "Content"("type", "isFeatured", "status", "publishedAt");
