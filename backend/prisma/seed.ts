import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcrypt';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = global.WebSocket;

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 3 roles: oraciones, repasos, director
  const users = [
    { username: 'user_oraciones', role: 'oraciones' },
    { username: 'user_repasos', role: 'repasos' },
    { username: 'director', role: 'director' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { role: u.role },
      create: {
        username: u.username,
        password: await bcrypt.hash('password123', 10),
        role: u.role,
      },
    });
  }

  // Eliminar usuarios viejos que ya no aplican
  await prisma.user.deleteMany({
    where: { username: { in: ['user_prayers_am', 'user_prayers_pm', 'user_rehearsal'] } },
  });

  // Miembros del coro con voces
  const members = [
    // Sopranos
    { name: 'Carmen Orellana', gender: 'F', voice: 'soprano' },
    { name: 'Abigail Lemus', gender: 'F', voice: 'soprano' },
    { name: 'Yohana Lemus', gender: 'F', voice: 'soprano' },
    { name: 'Helen Ramos', gender: 'F', voice: 'soprano' },
    { name: 'Liseth Taracena', gender: 'F', voice: 'soprano' },
    { name: 'Belén Carrillo', gender: 'F', voice: 'soprano' },
    { name: 'Salma Couox', gender: 'F', voice: 'soprano' },
    { name: 'Noemí Barrera', gender: 'F', voice: 'soprano' },
    { name: 'Febe Méndez', gender: 'F', voice: 'soprano' },
    // Segundas
    { name: 'Susana Orellana', gender: 'F', voice: 'segunda' },
    { name: 'Ana Ramos', gender: 'F', voice: 'segunda' },
    { name: 'Margoth Orellana', gender: 'F', voice: 'segunda' },
    { name: 'Saraí Márquez', gender: 'F', voice: 'segunda' },
    { name: 'Gabriela Hurtado', gender: 'F', voice: 'segunda' },
    { name: 'Libna Barrera', gender: 'F', voice: 'segunda' },
    // Tenores
    { name: 'Fredy Pérez', gender: 'M', voice: 'tenor' },
    { name: 'Benjamín Santos', gender: 'M', voice: 'tenor' },
    { name: 'Benjamín Coguox', gender: 'M', voice: 'tenor' },
    { name: 'Jaziel Márquez', gender: 'M', voice: 'tenor' },
    // Bajos
    { name: 'Abdiel Gutiérrez', gender: 'M', voice: 'bajo' },
    { name: 'Walter Pérez', gender: 'M', voice: 'bajo' },
    { name: 'Uziel Gutiérrez', gender: 'M', voice: 'bajo' },
    { name: 'Daniel Veliz', gender: 'M', voice: 'bajo' },
  ];

  for (const m of members) {
    const existing = await prisma.member.findFirst({ where: { name: m.name } });
    if (existing) {
      await prisma.member.update({ where: { id: existing.id }, data: { voice: m.voice } });
    } else {
      await prisma.member.create({ data: m });
    }
  }

  console.log('✅ Base de datos inicializada con 3 roles y 23 miembros!');
  console.log('');
  console.log('Credenciales:');
  console.log('  user_oraciones / password123  → marca oración 5am y 6pm');
  console.log('  user_repasos   / password123  → marca ensayos');
  console.log('  director       / password123  → ve todo');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());