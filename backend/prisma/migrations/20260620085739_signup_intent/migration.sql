-- CreateEnum
CREATE TYPE "SignupIntent" AS ENUM ('COACH', 'PLAYER', 'UNSURE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "signup_intent" "SignupIntent";
