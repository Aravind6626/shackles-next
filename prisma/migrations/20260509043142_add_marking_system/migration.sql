/*
  Warnings:

  - You are about to drop the column `gender` on the `Accommodation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[joinCode]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('SCAN_ATTENDANCE', 'SCAN_KIT', 'ONSPOT_INDIVIDUAL_REG', 'ONSPOT_TEAM_REG', 'MANAGE_TEAMS', 'MANAGE_SCORES');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('COORDINATOR', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('EVENT_ONLY', 'WORKSHOP_ONLY', 'COMBO');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('EVENT', 'WORKSHOP');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VOLUNTEER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TeamStatus" ADD VALUE 'OPEN';
ALTER TYPE "TeamStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "Payment_transactionId_key";

-- AlterTable
ALTER TABLE "Accommodation" DROP COLUMN "gender";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" "EventCategory",
ALTER COLUMN "year" SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "packageType" "PackageType",
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "joinCode" TEXT,
ADD COLUMN     "joinCodeExpiresAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gender" TEXT;

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" "Role" NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role","permission")
);

-- CreateTable
CREATE TABLE "EventStaffAssignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffRole" "StaffRole" NOT NULL,

    CONSTRAINT "EventStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkingCriteria" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Marking Criteria',
    "description" TEXT,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "numberOfJudges" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkingCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaComponent" (
    "id" TEXT NOT NULL,
    "markingCriteriaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weightPercentage" DECIMAL(5,2) NOT NULL,
    "maxMarksForComponent" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriteriaComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMark" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "markingCriteriaId" TEXT NOT NULL,
    "totalMarks" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "judgeCount" INTEGER NOT NULL DEFAULT 0,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentMark" (
    "id" TEXT NOT NULL,
    "teamMarkId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "averageMarks" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "judgeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeMarking" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "markingCriteriaId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "marksAwarded" DECIMAL(6,2) NOT NULL,
    "judgeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeMarking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventStaffAssignment_eventId_userId_idx" ON "EventStaffAssignment"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventStaffAssignment_eventId_userId_staffRole_key" ON "EventStaffAssignment"("eventId", "userId", "staffRole");

-- CreateIndex
CREATE UNIQUE INDEX "MarkingCriteria_eventId_key" ON "MarkingCriteria"("eventId");

-- CreateIndex
CREATE INDEX "MarkingCriteria_eventId_idx" ON "MarkingCriteria"("eventId");

-- CreateIndex
CREATE INDEX "CriteriaComponent_markingCriteriaId_idx" ON "CriteriaComponent"("markingCriteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaComponent_markingCriteriaId_order_key" ON "CriteriaComponent"("markingCriteriaId", "order");

-- CreateIndex
CREATE INDEX "TeamMark_markingCriteriaId_isSubmitted_idx" ON "TeamMark"("markingCriteriaId", "isSubmitted");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMark_teamId_markingCriteriaId_key" ON "TeamMark"("teamId", "markingCriteriaId");

-- CreateIndex
CREATE INDEX "ComponentMark_teamMarkId_componentId_idx" ON "ComponentMark"("teamMarkId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentMark_teamMarkId_componentId_key" ON "ComponentMark"("teamMarkId", "componentId");

-- CreateIndex
CREATE INDEX "JudgeMarking_markingCriteriaId_judgeId_idx" ON "JudgeMarking"("markingCriteriaId", "judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeMarking_teamId_markingCriteriaId_componentId_judgeId_key" ON "JudgeMarking"("teamId", "markingCriteriaId", "componentId", "judgeId");

-- CreateIndex
CREATE INDEX "Event_category_year_idx" ON "Event"("category", "year");

-- CreateIndex
CREATE INDEX "Payment_status_year_idx" ON "Payment"("status", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");

-- CreateIndex
CREATE INDEX "Team_joinCode_idx" ON "Team"("joinCode");

-- CreateIndex
CREATE INDEX "Team_eventId_status_idx" ON "Team"("eventId", "status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_shacklesId_idx" ON "User"("shacklesId");

-- CreateIndex
CREATE INDEX "User_qrToken_idx" ON "User"("qrToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_registrationType_role_idx" ON "User"("registrationType", "role");

-- AddForeignKey
ALTER TABLE "EventStaffAssignment" ADD CONSTRAINT "EventStaffAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaffAssignment" ADD CONSTRAINT "EventStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkingCriteria" ADD CONSTRAINT "MarkingCriteria_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaComponent" ADD CONSTRAINT "CriteriaComponent_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMark" ADD CONSTRAINT "TeamMark_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMark" ADD CONSTRAINT "TeamMark_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentMark" ADD CONSTRAINT "ComponentMark_teamMarkId_fkey" FOREIGN KEY ("teamMarkId") REFERENCES "TeamMark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentMark" ADD CONSTRAINT "ComponentMark_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CriteriaComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CriteriaComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
