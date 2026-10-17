import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    name: 'ClipForge',
    description: 'Local-first video studio',
  });
}
