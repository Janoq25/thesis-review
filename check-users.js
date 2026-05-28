
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  console.log(`User count: ${userCount}`);
  const users = await prisma.user.findMany({
    select: { email: true, role: true }
  });
  console.log('Users:', users);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
