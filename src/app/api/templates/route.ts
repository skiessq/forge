import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, saveTemplate, deleteTemplate, ProjectTemplate } from '@/lib/storage/templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = listTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || `tpl_${Date.now()}`;
    const name = body.name || 'Custom Template';

    const template: ProjectTemplate = {
      id,
      name,
      createdAt: new Date().toISOString(),
      layout: body.layout,
      subtitleStyle: body.subtitleStyle,
      introHook: body.introHook,
      watermark: body.watermark,
      audioSettings: body.audioSettings,
    };

    saveTemplate(template);
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
