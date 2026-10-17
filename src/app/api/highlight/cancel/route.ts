import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const cancelled = jobQueue.cancelJob(jobId);
    return NextResponse.json({ success: cancelled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
