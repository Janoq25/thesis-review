-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('VERIFIED', 'DOI_MISSING', 'DOI_INCORRECT', 'NOT_FOUND', 'UNINDEXED', 'POSSIBLE_HALLUCINATION');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "programId" TEXT,
    "advisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisTemplate" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "extractedSchema" JSONB NOT NULL,
    "rubric" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThesisTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateChunk" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunkIndex" INTEGER NOT NULL,

    CONSTRAINT "TemplateChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "advanceType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceChunk" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunkIndex" INTEGER NOT NULL,

    CONSTRAINT "AdvanceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "structureScore" DOUBLE PRECISION NOT NULL,
    "contentScore" DOUBLE PRECISION NOT NULL,
    "formScore" DOUBLE PRECISION NOT NULL,
    "originalityScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "gradeConverted" DOUBLE PRECISION NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "processingMs" INTEGER NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFinding" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sectionRef" TEXT NOT NULL,
    "pageRef" INTEGER,
    "severity" "FindingSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "correctionSteps" TEXT NOT NULL,
    "exampleImprovement" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "humanAccepted" BOOLEAN,
    "humanComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineTuningDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pairCount" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FineTuningDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineTuningPair" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "originalOutput" JSONB NOT NULL,
    "humanCorrection" JSONB NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "advanceType" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "datasetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineTuningPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "finalGrade" DOUBLE PRECISION,
    "humanComment" TEXT,
    "rubricAnswers" JSONB NOT NULL,
    "status" "AdvanceStatus" NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAnnotation" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "xPos" DOUBLE PRECISION,
    "yPos" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlagiarismReport" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "overallSimilarity" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "scanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlagiarismReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlagiarismAlert" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "sourceUrl" TEXT,
    "matchedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlagiarismAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceAnalysis" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "doi" TEXT,
    "title" TEXT,
    "authors" TEXT,
    "year" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "crossrefData" JSONB,
    "issues" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrcidProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orcidId" TEXT NOT NULL,
    "name" TEXT,
    "bio" TEXT,
    "works" JSONB,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrcidProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_token_key" ON "UserPushToken"("token");

-- CreateIndex
CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIAnalysis_advanceId_key" ON "AIAnalysis"("advanceId");

-- CreateIndex
CREATE INDEX "FineTuningPair_datasetId_createdAt_idx" ON "FineTuningPair"("datasetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_advanceId_key" ON "Review"("advanceId");

-- CreateIndex
CREATE INDEX "ReviewAnnotation_reviewId_pageNumber_idx" ON "ReviewAnnotation"("reviewId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlagiarismReport_advanceId_key" ON "PlagiarismReport"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceAnalysis_advanceId_key" ON "ReferenceAnalysis"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrcidProfile_userId_key" ON "OrcidProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrcidProfile_orcidId_key" ON "OrcidProfile"("orcidId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_userId_key" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushToken" ADD CONSTRAINT "UserPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThesisTemplate" ADD CONSTRAINT "ThesisTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateChunk" ADD CONSTRAINT "TemplateChunk_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceChunk" ADD CONSTRAINT "AdvanceChunk_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFinding" ADD CONSTRAINT "AIFinding_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTuningPair" ADD CONSTRAINT "FineTuningPair_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTuningPair" ADD CONSTRAINT "FineTuningPair_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AIFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineTuningPair" ADD CONSTRAINT "FineTuningPair_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "FineTuningDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnnotation" ADD CONSTRAINT "ReviewAnnotation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlagiarismReport" ADD CONSTRAINT "PlagiarismReport_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlagiarismAlert" ADD CONSTRAINT "PlagiarismAlert_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PlagiarismReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceAnalysis" ADD CONSTRAINT "ReferenceAnalysis_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ReferenceAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcidProfile" ADD CONSTRAINT "OrcidProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
