/**
 * Simple In-Memory Job Queue
 * 
 * Lightweight queue system for background document processing.
 * Features: Retry logic, error handling, concurrent workers.
 * 
 * Note: Jobs are lost on server restart (in-memory only).
 * For production, consider migrating to Redis-backed queue.
 */

type JobHandler<T = unknown> = (data: T) => Promise<void>;

interface Job<T = unknown> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

interface QueueOptions {
  maxAttempts?: number;
  concurrency?: number;
  retryDelay?: number; // milliseconds
}

export class SimpleQueue<T = unknown> {
  private queue: Job<T>[] = [];
  private processing = new Set<string>();
  private handler: JobHandler<T>;
  private options: Required<QueueOptions>;
  private isRunning = false;

  constructor(handler: JobHandler<T>, options: QueueOptions = {}) {
    this.handler = handler;
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      concurrency: options.concurrency ?? 2,
      retryDelay: options.retryDelay ?? 1000,
    };
  }

  /**
   * Add job to queue
   */
  async add(data: T, jobId?: string): Promise<string> {
    const id = jobId ?? `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job<T> = {
      id,
      data,
      attempts: 0,
      maxAttempts: this.options.maxAttempts,
      createdAt: new Date(),
    };

    this.queue.push(job);
    console.log(`[Queue] Job added: ${id} (queue size: ${this.queue.length})`);

    // Start processing if not already running
    if (!this.isRunning) {
      this.start();
    }

    return id;
  }

  /**
   * Start processing queue
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('[Queue] Started processing');

    // Start worker processes
    for (let i = 0; i < this.options.concurrency; i++) {
      this.processNext();
    }
  }

  /**
   * Stop processing queue
   */
  stop(): void {
    this.isRunning = false;
    console.log('[Queue] Stopped processing');
  }

  /**
   * Process next job in queue
   */
  private async processNext(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Find next available job
    const job = this.queue.find(j => !this.processing.has(j.id) && j.attempts < j.maxAttempts);

    if (!job) {
      // No jobs available, check again in 1 second
      setTimeout(() => this.processNext(), 1000);
      return;
    }

    // Mark job as processing
    this.processing.add(job.id);
    job.attempts++;

    console.log(`[Queue] Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);

    try {
      // Execute job handler
      await this.handler(job.data);

      // Success - remove from queue
      this.queue = this.queue.filter(j => j.id !== job.id);
      this.processing.delete(job.id);

      console.log(`[Queue] Job completed: ${job.id}`);

      // Process next job immediately
      setImmediate(() => this.processNext());

    } catch (error) {
      console.error(`[Queue] Job failed: ${job.id}`, error);

      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.processedAt = new Date();
      this.processing.delete(job.id);

      // Retry or fail
      if (job.attempts < job.maxAttempts) {
        const delay = this.options.retryDelay * job.attempts; // Exponential backoff
        console.log(`[Queue] Retrying job ${job.id} in ${delay}ms`);
        
        setTimeout(() => this.processNext(), delay);
      } else {
        console.error(`[Queue] Job failed permanently: ${job.id}`);
        // Keep in queue for debugging but mark as failed
      }

      // Continue processing other jobs
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      pending: this.queue.filter(j => j.attempts < j.maxAttempts).length,
      failed: this.queue.filter(j => j.attempts >= j.maxAttempts).length,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job<T> | undefined {
    return this.queue.find(j => j.id === jobId);
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    console.log('[Queue] Cleared all jobs');
  }
}

// Export singleton instance for document processing
import { indexDocument, IndexDocumentParams } from '@/mastra/services/rag-service';

export const documentQueue = new SimpleQueue<IndexDocumentParams>(
  indexDocument,
  {
    maxAttempts: 3,
    concurrency: 2,
    retryDelay: 2000,
  }
);
