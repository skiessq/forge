import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const jobId = params.id;
  const initialJob = jobQueue.getJob(jobId);

  if (!initialJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Create SSE stream
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial state immediately
  writer.write(encoder.encode(`data: ${JSON.stringify(initialJob)}\n\n`));

  const onUpdate = (updatedJob: any) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(updatedJob)}\n\n`));
    if (updatedJob.status === 'completed' || updatedJob.status === 'failed' || updatedJob.status === 'cancelled') {
      cleanup();
    }
  };

  const cleanup = () => {
    jobQueue.off(`update:${jobId}`, onUpdate);
    try {
      writer.close();
    } catch {}
  };

  jobQueue.on(`update:${jobId}`, onUpdate);

  // If already finished, close
  if (initialJob.status === 'completed' || initialJob.status === 'failed' || initialJob.status === 'cancelled') {
    cleanup();
  }

  req.signal.addEventListener('abort', cleanup);

  return new NextResponse(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

// POST or DELETE to cancel a job
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const success = jobQueue.cancelJob(params.id);
  return NextResponse.json({ success });
}
