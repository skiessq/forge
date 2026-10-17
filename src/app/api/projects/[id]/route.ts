import { NextResponse } from 'next/server';
import { getProject, saveProject, deleteProject } from '@/lib/storage/workspace';
import { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = getProject(params.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const projectData = (await req.json()) as Project;
    if (!projectData || projectData.id !== params.id) {
      return NextResponse.json({ error: 'Invalid project data or ID mismatch' }, { status: 400 });
    }

    saveProject(projectData);
    return NextResponse.json({ success: true, project: projectData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const success = deleteProject(params.id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
