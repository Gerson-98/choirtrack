const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const bcrypt = require('bcrypt');

const { neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = global.WebSocket;

const connectionString = 'postgresql://neondb_owner:npg_mHT0zAo7WUlN@ep-silent-cake-anv3otqg-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    const users = [
        { username: 'user_prayers_am', role: 'am_prayer' },
        { username: 'user_prayers_pm', role: 'pm_prayer' },
        { username: 'user_rehearsal', role: 'rehearsal' },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { username: u.username },
            update: {},
            create: {
                username: u.username,
                password: await bcrypt.hash('password123', 10),
                role: u.role,
            },
        });
    }

    const members = [
        { name: 'John Doe', gender: 'Male' },
        { name: 'Jane Smith', gender: 'Female' },
        { name: 'Michael Johnson', gender: 'Male' },
        { name: 'Emily Davis', gender: 'Female' },
        { name: 'Daniel Brown', gender: 'Male' },
        { name: 'Sarah Smith', gender: 'Female' },
        { name: 'James Taylor', gender: 'Male' },
        { name: 'Olivia Martinez', gender: 'Female' },
        { name: 'Arthur Anderson', gender: 'Male' },
        { name: 'Sophia Thomas', gender: 'Female' },
    ];

    for (const m of members) {
        const existing = await prisma.member.findFirst({ where: { name: m.name } });
        if (!existing) {
            await prisma.member.create({ data: m });
        }
    }

    console.log('✅ Database seeded successfully!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());