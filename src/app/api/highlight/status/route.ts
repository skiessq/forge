import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = jobQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let result = null;
    if (job.status === 'completed' && job.message) {
      try {
        result = JSON.parse(job.message);
      } catch {}
    }

    return NextResponse.json({ job, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
