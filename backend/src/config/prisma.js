import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully via Prisma');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log('PostgreSQL disconnected');
  } catch (error) {
    console.error('Error disconnecting from PostgreSQL:', error);
  }
};

export default prisma;

