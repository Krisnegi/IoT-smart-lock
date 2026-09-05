import bcrypt from 'bcrypt';
import { prisma } from './db';
import { redis } from './redis';
import { Role } from '@prisma/client';

/**
 * Auto-seeds default admin credentials and a default lock for recruiter demo use.
 */
export const seedDatabase = async () => {
  console.log('🌱 Checking database seeding...');

  try {
    // 1. Seed Admin User
    let admin = await prisma.user.findFirst({
      where: { email: 'admin@example.com' },
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('adminpassword123', 10);
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          role: Role.ADMIN,
        },
      });
      console.log('👤 Seeded Admin User (admin@example.com / adminpassword123)');
    } else {
      console.log('ℹ️ Admin User already exists.');
    }

    // 2. Seed Default Lock
    let lock = await prisma.lock.findUnique({
      where: { id: 'front-gate-01' },
    });

    if (!lock) {
      lock = await prisma.lock.create({
        data: {
          id: 'front-gate-01',
          name: 'Front Gate Lock',
          isOnline: true,
          lastHeartbeat: new Date(),
        },
      });
      console.log("🔒 Seeded default lock 'front-gate-01'.");
    } else {
      lock = await prisma.lock.update({
        where: { id: 'front-gate-01' },
        data: {
          isOnline: true,
          lastHeartbeat: new Date(),
        },
      });
      console.log("ℹ️ Updated lock 'front-gate-01' status to ONLINE.");
    }

    // Sync Redis cache state
    await redis.set('lock:front-gate-01:registered', 'true');
    await redis.set('lock:front-gate-01:is_online', 'true');
    await redis.set('lock:front-gate-01:status', 'LOCKED');
    await redis.set('lock:front-gate-01:heartbeat', Date.now().toString());

    // 3. Grant Permission
    const permission = await prisma.userLockPermission.findFirst({
      where: {
        userId: admin.id,
        lockId: lock.id,
      },
    });

    if (!permission) {
      await prisma.userLockPermission.create({
        data: {
          userId: admin.id,
          lockId: lock.id,
        },
      });
      console.log("🔑 Granted Admin user permission for lock 'front-gate-01'.");
    }
    
    console.log('🌱 Seeding process finished.');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  }
};
