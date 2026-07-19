CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '#2521E1',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

INSERT INTO "Category" ("id", "name", "slug", "description", "color", "sortOrder", "isActive", "updatedAt") VALUES
('cat_business', 'Business', 'business', 'Markets, companies, work, and money.', '#BC9B56', 10, true, CURRENT_TIMESTAMP),
('cat_technology', 'Technology', 'technology', 'Platforms, AI, products, and digital culture.', '#2521E1', 20, true, CURRENT_TIMESTAMP),
('cat_culture', 'Culture', 'culture', 'Creative industries, media, arts, and identity.', '#AF585D', 30, true, CURRENT_TIMESTAMP),
('cat_world', 'World', 'world', 'International affairs and global shifts.', '#4C4543', 40, true, CURRENT_TIMESTAMP),
('cat_science', 'Science', 'science', 'Research, discovery, health, and climate.', '#2F6650', 50, true, CURRENT_TIMESTAMP),
('cat_sport', 'Sport', 'sport', 'Competition, teams, athletes, and performance.', '#E15D2A', 60, true, CURRENT_TIMESTAMP);
