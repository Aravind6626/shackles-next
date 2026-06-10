-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APPLICANT', 'PARTICIPANT', 'VOLUNTEER', 'ADMIN', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('SCAN_ATTENDANCE', 'SCAN_KIT', 'ONSPOT_INDIVIDUAL_REG', 'ONSPOT_TEAM_REG', 'MANAGE_TEAMS', 'MANAGE_SCORES', 'MANAGE_SUBMISSIONS');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('COORDINATOR', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('EVENT_ONLY', 'WORKSHOP_ONLY', 'COMBO');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('EVENT', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('GENERAL', 'WORKSHOP', 'COMBO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentCaptureSource" AS ENUM ('WEBSITE', 'ON_SPOT');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('ONLINE', 'ON_SPOT', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "RegistrationSyncStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "RegistrationOperationType" AS ENUM ('KIT', 'ATTENDANCE', 'QUICK_REGISTER', 'TEAM_ADD', 'TEAM_COMPLETE');

-- CreateEnum
CREATE TYPE "KitStatus" AS ENUM ('PENDING', 'ISSUED');

-- CreateEnum
CREATE TYPE "EventParticipationMode" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('OPEN', 'DRAFT', 'LOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "PaperSelectionStatus" AS ENUM ('PENDING', 'SELECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "collegeName" TEXT NOT NULL,
    "collegeLoc" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "yearOfStudy" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'APPLICANT',
    "registrationType" "RegistrationType" NOT NULL DEFAULT 'GENERAL',
    "gender" TEXT,
    "shacklesId" TEXT,
    "qrToken" TEXT,
    "qrImageUrl" TEXT,
    "qrPath" TEXT,
    "qrTokenExpiry" TIMESTAMP(3),
    "lastQrScan" TIMESTAMP(3),
    "kitStatus" "KitStatus" NOT NULL DEFAULT 'PENDING',
    "kitIssuedAt" TIMESTAMP(3),
    "kitIssuedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "proofPath" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ONLINE',
    "captureSource" "PaymentCaptureSource" NOT NULL DEFAULT 'WEBSITE',
    "packageType" "PackageType",
    "year" INTEGER,
    "verificationDeviceId" TEXT,
    "verificationNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnSpotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "stationId" TEXT,
    "deviceId" TEXT,
    "referralSource" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnSpotProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "days" TEXT[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer,
    "type" TEXT,
    "category" "EventCategory",
    "dayLabel" TEXT,
    "date" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "rulesUrl" TEXT,
    "submissionUrl" TEXT,
    "submissionDeadline" TIMESTAMP(3),
    "requiresDocumentSubmission" BOOLEAN NOT NULL DEFAULT false,
    "coordinatorName" TEXT,
    "coordinatorPhone" TEXT,
    "trainerName" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "participationMode" "EventParticipationMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "teamMinSize" INTEGER,
    "teamMaxSize" INTEGER,
    "maxTeams" INTEGER,
    "maxParticipants" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "joinCode" TEXT,
    "joinCodeExpiresAt" TIMESTAMP(3),
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "status" "TeamStatus" NOT NULL DEFAULT 'OPEN',
    "leaderUserId" TEXT,
    "leaderContactPhoneSnapshot" TEXT,
    "leaderContactEmailSnapshot" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT,
    "memberRole" "TeamMemberRole",
    "teamName" TEXT,
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendedAt" TIMESTAMP(3),
    "source" "RegistrationSource" NOT NULL DEFAULT 'ONLINE',
    "syncStatus" "RegistrationSyncStatus" NOT NULL DEFAULT 'APPLIED',
    "stationId" TEXT,
    "clientOperationId" TEXT,
    "syncError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "year" INTEGER,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationOperation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "operationType" "RegistrationOperationType" NOT NULL,
    "actorUserId" TEXT,
    "participantId" TEXT,
    "eventName" TEXT,
    "teamName" TEXT,
    "teamLeaderUserId" TEXT,
    "payload" JSONB,
    "payloadHash" TEXT,
    "status" "RegistrationSyncStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShacklesIdSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "registrationType" "RegistrationType" NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShacklesIdSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
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

-- CreateTable
CREATE TABLE "PaperSubmission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "abstractUrl" TEXT,
    "abstractSubmittedAt" TIMESTAMP(3),
    "abstractDeadline" TIMESTAMP(3),
    "selectionStatus" "PaperSelectionStatus" NOT NULL DEFAULT 'PENDING',
    "selectedAt" TIMESTAMP(3),
    "selectedBy" TEXT,
    "selectionNote" TEXT,
    "presentationUrl" TEXT,
    "presentationSubmittedAt" TIMESTAMP(3),
    "presentationDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_shacklesId_key" ON "User"("shacklesId");

-- CreateIndex
CREATE UNIQUE INDEX "User_qrToken_key" ON "User"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

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

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_key" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_captureSource_status_createdAt_idx" ON "Payment"("captureSource", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_paymentChannel_status_createdAt_idx" ON "Payment"("paymentChannel", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_year_idx" ON "Payment"("status", "year");

-- CreateIndex
CREATE UNIQUE INDEX "OnSpotProfile_userId_key" ON "OnSpotProfile"("userId");

-- CreateIndex
CREATE INDEX "OnSpotProfile_createdByUserId_createdAt_idx" ON "OnSpotProfile"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OnSpotProfile_stationId_createdAt_idx" ON "OnSpotProfile"("stationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Accommodation_userId_key" ON "Accommodation"("userId");

-- CreateIndex
CREATE INDEX "Event_year_isArchived_isActive_idx" ON "Event"("year", "isArchived", "isActive");

-- CreateIndex
CREATE INDEX "Event_year_isTemplate_idx" ON "Event"("year", "isTemplate");

-- CreateIndex
CREATE INDEX "Event_category_year_idx" ON "Event"("category", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Event_year_name_key" ON "Event"("year", "name");

-- CreateIndex
CREATE INDEX "EventStaffAssignment_eventId_userId_idx" ON "EventStaffAssignment"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventStaffAssignment_eventId_userId_staffRole_key" ON "EventStaffAssignment"("eventId", "userId", "staffRole");

-- CreateIndex
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");

-- CreateIndex
CREATE INDEX "Team_joinCode_idx" ON "Team"("joinCode");

-- CreateIndex
CREATE INDEX "Team_eventId_status_idx" ON "Team"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_eventId_nameNormalized_key" ON "Team"("eventId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Team_eventId_teamCode_key" ON "Team"("eventId", "teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvite_invitedByUserId_idx" ON "TeamInvite"("invitedByUserId");

-- CreateIndex
CREATE INDEX "TeamInvite_invitedEmail_idx" ON "TeamInvite"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_clientOperationId_key" ON "EventRegistration"("clientOperationId");

-- CreateIndex
CREATE INDEX "EventRegistration_year_eventId_idx" ON "EventRegistration"("year", "eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_source_idx" ON "EventRegistration"("eventId", "source");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_teamId_idx" ON "EventRegistration"("eventId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_userId_eventId_key" ON "EventRegistration"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationOperation_operationId_key" ON "RegistrationOperation"("operationId");

-- CreateIndex
CREATE INDEX "RegistrationOperation_stationId_createdAt_idx" ON "RegistrationOperation"("stationId", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationOperation_status_createdAt_idx" ON "RegistrationOperation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationOperation_participantId_idx" ON "RegistrationOperation"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShacklesIdSequence_year_registrationType_key" ON "ShacklesIdSequence"("year", "registrationType");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

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
CREATE UNIQUE INDEX "PaperSubmission_teamId_key" ON "PaperSubmission"("teamId");

-- CreateIndex
CREATE INDEX "PaperSubmission_eventId_selectionStatus_idx" ON "PaperSubmission"("eventId", "selectionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PaperSubmission_teamId_eventId_key" ON "PaperSubmission"("teamId", "eventId");

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnSpotProfile" ADD CONSTRAINT "OnSpotProfile_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnSpotProfile" ADD CONSTRAINT "OnSpotProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_templateSourceId_fkey" FOREIGN KEY ("templateSourceId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaffAssignment" ADD CONSTRAINT "EventStaffAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaffAssignment" ADD CONSTRAINT "EventStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkingCriteria" ADD CONSTRAINT "MarkingCriteria_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaComponent" ADD CONSTRAINT "CriteriaComponent_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMark" ADD CONSTRAINT "TeamMark_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMark" ADD CONSTRAINT "TeamMark_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentMark" ADD CONSTRAINT "ComponentMark_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CriteriaComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentMark" ADD CONSTRAINT "ComponentMark_teamMarkId_fkey" FOREIGN KEY ("teamMarkId") REFERENCES "TeamMark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "CriteriaComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_markingCriteriaId_fkey" FOREIGN KEY ("markingCriteriaId") REFERENCES "MarkingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeMarking" ADD CONSTRAINT "JudgeMarking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSubmission" ADD CONSTRAINT "PaperSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSubmission" ADD CONSTRAINT "PaperSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
