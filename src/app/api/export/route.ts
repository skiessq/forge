import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/storage/workspace';
import { runFFmpegExport } from '@/lib/ffmpeg/runner';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectId, settings } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const jobId = `job_export_${Date.now()}`;
    jobQueue.createJob(jobId, 'export', projectId, 'Queueing export render...');

    // Run export asynchronously in background
    runFFmpegExport(project, jobId, settings).catch((err) => {
      console.error('Export runner background error:', err);
    });

    return NextResponse.json({ jobId, success: true });
  } catch (error: any) {
    console.error('Export route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
