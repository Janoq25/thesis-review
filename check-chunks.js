const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.advanceChunk.count();
  console.log(`Total advance chunks: ${count}`);
  
  const advances = await prisma.advance.findMany({
    take: 5,
    include: { _count: { select: { chunks: true } } }
  });
  
  console.log('Advances sample:');
  advances.forEach(a => {
    console.log(`ID: ${a.id}, Title: ${a.title}, Chunks: ${a._count.chunks}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
