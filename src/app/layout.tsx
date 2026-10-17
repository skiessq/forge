import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClipForge - AI Long to Short-Form Video Studio',
  description: 'Turn Twitch clips and gameplay into viral TikTok, Reels, and Shorts with layout templates, auto subtitles, and GPU-accelerated export.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Inter:wght@400;600;700;800&family=Luckiest+Guy&family=Montserrat:wght@700;800;900&family=Oswald:wght@600;700&family=Rubik+Glitch&family=Russo+One&family=Titan+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-forge-bg text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
