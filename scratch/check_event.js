
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.findFirst({
    where: { name: 'KIT DISTRIBUTION' }
  });
  console.log('Event found:', event);
  if (!event) {
    const newEvent = await prisma.event.create({
      data: {
        name: 'KIT DISTRIBUTION',
        type: 'SPECIAL',
        participationMode: 'INDIVIDUAL',
        isActive: true,
        year: 2026 // or whatever current year is
      }
    });
    console.log('Created event:', newEvent);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
