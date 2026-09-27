import dotenv from 'dotenv';
import { db } from './db';
import { jobQueue } from './jobQueue';

dotenv.config();

console.log('[VELORA AI Worker] Background generation worker initialized.');
console.log(`[VELORA AI Worker] Process PID: ${process.pid}`);

let isRunning = true;

async function runWorkerLoop() {
  while (isRunning) {
    try {
      // Find queued jobs that haven't been picked up
      const queuedGenerations = db.getGenerationsByStatus('QUEUED');
      if (queuedGenerations.length > 0) {
        for (const job of queuedGenerations) {
          console.log(`[VELORA AI Worker] Picked up queued job: ${job.id} (${job.type})`);
          await jobQueue.enqueue(job.id);
        }
      }
    } catch (err: any) {
      console.error('[VELORA AI Worker] Error in job poll cycle:', err?.message);
    }

    // Sleep for 2.5 seconds between polling checks
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

process.on('SIGTERM', () => {
  console.log('[VELORA AI Worker] Received SIGTERM, shutting down gracefully...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[VELORA AI Worker] Received SIGINT, shutting down gracefully...');
  isRunning = false;
  process.exit(0);
});

runWorkerLoop().catch((err) => {
  console.error('[VELORA AI Worker] Fatal error:', err);
  process.exit(1);
});
