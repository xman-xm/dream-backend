-- Remove device push tokens after disabling Firebase/Expo remote push delivery.
ALTER TABLE "User" DROP COLUMN IF EXISTS "pushToken";