CREATE TYPE "MenuCategory" AS ENUM ('FOOD', 'DRINK');
ALTER TABLE "MenuItem" ADD COLUMN "category" "MenuCategory" NOT NULL DEFAULT 'FOOD';
UPDATE "MenuItem" SET "category" = 'DRINK' WHERE "name" = 'تروبيت';
