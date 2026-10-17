import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/storage/workspace';
import { jobQueue } from '@/lib/jobs/queue';
import { runAutoHighlightPipeline } from '@/lib/highlight/pipeline';
import { HighlightConfig } from '@/lib/highlight/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, config } = body as { projectId: string; config: HighlightConfig };

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.source?.path) {
      return NextResponse.json({ error: 'Project source media path is missing' }, { status: 400 });
    }

    const duration = project.source.probe?.duration || 10;
    const jobId = `job_highlight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create background job
    jobQueue.createJob(
      jobId,
      'transcription', // reuse type for queue compatibility
      projectId,
      'Starting Auto-Highlight AI analysis...'
    );

    // Run pipeline asynchronously in background
    (async () => {
      try {
        await runAutoHighlightPipeline({
          jobId,
          sourcePath: project.source.path,
          sourceDuration: duration,
          config: {
            ...config,
            geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY,
          },
        });
      } catch (err: any) {
        console.error(`Highlight job ${jobId} failed:`, err);
        const currentJob = jobQueue.getJob(jobId);
        if (currentJob && currentJob.status !== 'cancelled') {
          jobQueue.updateProgress(jobId, {
            status: 'failed',
            stage: 'Auto-Highlight analysis failed',
            error: err.message,
          });
        }
      }
    })();

    return NextResponse.json({ success: true, jobId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
