import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="#090D16"/>
  <rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="url(#g)" stroke-width="1.5"/>
  <path d="M9 10 L23 22 M23 10 L9 22" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="9" cy="10" r="2" fill="#38BDF8"/>
  <circle cx="9" cy="22" r="2" fill="#38BDF8"/>
</svg>`;

export async function GET() {
  return new NextResponse(ICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
