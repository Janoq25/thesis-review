const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plagiarismReports = await prisma.plagiarismReport.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { advanceId: true, status: true, overallSimilarity: true }
  });
  
  const aiAnalyses = await prisma.aIAnalysis.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { advanceId: true, overallScore: true, gradeConverted: true }
  });
  
  console.log('--- Plagiarism Reports ---');
  console.table(plagiarismReports);
  
  console.log('--- AI Analyses ---');
  console.table(aiAnalyses);
}

main().catch(console.error).finally(() => prisma.$disconnect());
