import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage/workspace';
import { listTemplates } from '@/lib/storage/templates';
import { runFFmpegExport } from '@/lib/ffmpeg/runner';
import { jobQueue } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectIds, templateId, settings } = await req.json();

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'No projectIds provided for batch export' }, { status: 400 });
    }

    const jobId = `job_batch_${Date.now()}`;
    jobQueue.createJob(jobId, 'export', undefined, `Batch queue starting for ${projectIds.length} clips...`);

    // Run batch sequentially in background
    (async () => {
      const results: string[] = [];
      const template = templateId ? listTemplates().find((t) => t.id === templateId) : null;

      for (let i = 0; i < projectIds.length; i++) {
        const pId = projectIds[i];
        const project = getProject(pId);
        if (!project) continue;

        // Apply template if requested
        if (template) {
          project.layout = template.layout;
          project.subtitleStyle = template.subtitleStyle;
          if (template.introHook) project.introHook = template.introHook;
          if (template.watermark) project.watermark = template.watermark;
          if (template.audioSettings) project.audioSettings = template.audioSettings;
          saveProject(project);
        }

        const pct = Math.round((i / projectIds.length) * 100);
        jobQueue.updateProgress(jobId, {
          status: 'running',
          progress: pct,
          stage: `[${i + 1}/${projectIds.length}] Exporting "${project.name}"...`,
        });

        const singleJobId = `job_batch_item_${Date.now()}_${i}`;
        jobQueue.createJob(singleJobId, 'export', pId, `Rendering ${project.name}...`);

        try {
          const out = await runFFmpegExport(project, singleJobId, {
            ...settings,
            outputFileName: `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_batch.mp4`,
          });
          results.push(out);
        } catch (e: any) {
          console.error(`Error exporting ${pId}:`, e);
        }
      }

      jobQueue.updateProgress(jobId, {
        status: 'completed',
        progress: 100,
        stage: `Batch export complete! Exported ${results.length}/${projectIds.length} videos.`,
      });
    })();

    return NextResponse.json({ jobId, total: projectIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
