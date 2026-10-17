import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { JobProgress } from '../types';

class JobQueue extends EventEmitter {
  private jobs: Map<string, JobProgress> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  createJob(id: string, type: JobProgress['type'], projectId?: string, initialStage = 'Initializing...'): JobProgress {
    const job: JobProgress = {
      id,
      projectId,
      type,
      status: 'pending',
      progress: 0,
      stage: initialStage,
    };
    this.jobs.set(id, job);
    this.emit(`update:${id}`, job);
    return job;
  }

  getJob(id: string): JobProgress | undefined {
    return this.jobs.get(id);
  }

  updateProgress(id: string, update: Partial<JobProgress>): void {
    const job = this.jobs.get(id);
    if (!job) return;

    Object.assign(job, update);
    this.emit(`update:${id}`, job);
    this.emit('jobUpdated', job);
  }

  registerProcess(id: string, child: ChildProcess): void {
    this.processes.set(id, child);
  }

  unregisterProcess(id: string): void {
    this.processes.delete(id);
  }

  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    const proc = this.processes.get(id);
    if (proc) {
      try {
        if (process.platform === 'win32') {
          // On Windows, tree-kill or taskkill
          const { execSync } = require('child_process');
          execSync(`taskkill /pid ${proc.pid} /T /F`);
        } else {
          proc.kill('SIGTERM');
        }
      } catch (e) {
        console.warn(`Error killing process for job ${id}:`, e);
      }
      this.processes.delete(id);
    }

    job.status = 'cancelled';
    job.stage = 'Cancelled by user';
    this.emit(`update:${id}`, job);
    return true;
  }
}

// Global singleton for Next.js API runtime
const globalForJobs = globalThis as unknown as { jobQueue?: JobQueue };
export const jobQueue = globalForJobs.jobQueue || new JobQueue();
if (process.env.NODE_ENV !== 'production') globalForJobs.jobQueue = jobQueue;
