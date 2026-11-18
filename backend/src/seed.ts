import bcrypt = require('bcryptjs');
import { prisma } from './db';

async function main(): Promise<void> {
  const organisationName = process.env.SEED_ORG_NAME;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!organisationName || !email || !password) {
    throw new Error('Set the seed values in backend/.env first');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('Seed user already exists; no changes made.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.organisation.create({
    data: {
      name: organisationName,
      users: {
        create: {
          email,
          passwordHash,
          role: 'ADMIN',
          name: 'Development Admin',
          skills: [],
        },
      },
    },
  });

  console.log(`Created development user: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Could not create development user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });