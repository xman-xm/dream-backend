-- Remove advertisement catalog, placement records, and sponsored-post fields.
DROP TABLE IF EXISTS "AdPlacement";
DROP TABLE IF EXISTS "AdProduct";

ALTER TABLE "Post"
  DROP COLUMN IF EXISTS "isSponsored",
  DROP COLUMN IF EXISTS "sponsoredStatus",
  DROP COLUMN IF EXISTS "viewsCount",
  DROP COLUMN IF EXISTS "qualifyingViews",
  DROP COLUMN IF EXISTS "minExposureTarget",
  DROP COLUMN IF EXISTS "canDelete",
  DROP COLUMN IF EXISTS "generationCostUSD";