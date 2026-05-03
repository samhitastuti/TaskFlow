import { Worker, Queue } from 'bullmq';
import prisma from '../lib/prisma';
import redis from '../lib/redis';

const connection = redis;

export const notificationQueue = new Queue('notifications', { connection });

export const notificationWorker = new Worker('notifications', async job => {
  console.log('Checking for pending notifications...');
  
  const pending = await prisma.notification.findMany({
    where: {
      scheduled_for: { lte: new Date() },
      sent_at: null
    }
  });

  for (const notification of pending) {
    // In a real app, send via Web Push or Email here
    console.log(`Sending notification ${notification.id} to user ${notification.user_id}`);
    
    await prisma.notification.update({
      where: { id: notification.id },
      data: { sent_at: new Date() }
    });
  }
}, { connection });
