import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: 'postgresql://neondb_owner:npg_mHT0zAo7WUlN@ep-silent-cake-anv3otqg-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  },
  migrations: {
    seed: 'npx ts-node prisma/seed.ts',
  },
});