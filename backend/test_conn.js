const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const bcrypt = require('bcrypt');

// Neon serverless requires global WebSocket in node environments when doing Pool/Websockets
const { neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = global.WebSocket;

const connectionString = 'postgresql://neondb_owner:npg_mHT0zAo7WUlN@ep-silent-cake-anv3otqg-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.user.count();
  console.log("Users count:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
