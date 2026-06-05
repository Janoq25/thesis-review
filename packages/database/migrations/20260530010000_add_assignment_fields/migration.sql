-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "templateId" TEXT,
ADD COLUMN "advanceType" TEXT NOT NULL DEFAULT 'chapter_1';

-- CreateIndex
CREATE INDEX "Assignment_templateId_idx" ON "Assignment"("templateId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ThesisTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
