/*
  Warnings:

  - You are about to drop the `Media` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `media` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Media" DROP CONSTRAINT "Media_postId_fkey";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "media" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "Post" ALTER COLUMN "media" DROP DEFAULT,
ALTER COLUMN "type" DROP DEFAULT;

-- DropTable
DROP TABLE "Media";
