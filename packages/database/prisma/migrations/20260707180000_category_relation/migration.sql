ALTER TABLE "Content" ADD COLUMN "categoryId" TEXT;

UPDATE "Content"
SET "categoryId" = "Category"."id"
FROM "Category"
WHERE lower("Content"."category") = lower("Category"."name");

CREATE INDEX "Content_type_categoryId_status_publishedAt_idx" ON "Content"("type", "categoryId", "status", "publishedAt");

ALTER TABLE "Content" ADD CONSTRAINT "Content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
