-- Fix PlagiarismReport table
ALTER TABLE "PlagiarismReport" ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION;
ALTER TABLE "PlagiarismReport" ADD COLUMN IF NOT EXISTS "method" TEXT DEFAULT 'embeddings';
ALTER TABLE "PlagiarismReport" ADD COLUMN IF NOT EXISTS "copyleaksReportKey" TEXT;

-- Fix Review table status column
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Review' AND column_name = 'status' AND data_type = 'text') THEN
        ALTER TABLE "Review" DROP COLUMN "status";
    END IF;
END $$;

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Review" ALTER COLUMN "status" DROP DEFAULT;

-- Fix PlagiarismAlert table
ALTER TABLE "PlagiarismAlert" ADD COLUMN IF NOT EXISTS "matchedText" TEXT NOT NULL DEFAULT '';
