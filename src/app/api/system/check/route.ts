import { NextResponse } from 'next/server';
import { checkSystemDependencies } from '@/lib/ffmpeg/systemCheck';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = checkSystemDependencies();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
