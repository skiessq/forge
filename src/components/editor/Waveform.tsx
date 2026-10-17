'use client';

import React, { useEffect, useRef } from 'react';

interface Props {
  duration: number;
  zoom: number; // px per second
  height?: number;
  color?: string;
}

export default function Waveform({ duration, zoom, height = 36, color = '#10B981' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = Math.max(800, duration * zoom);
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Draw stylized audio peaks
    const barWidth = 3;
    const gap = 2;
    const totalBars = Math.floor(width / (barWidth + gap));
    const midY = height / 2;

    ctx.fillStyle = color;

    // Use deterministic pseudo-random waveform peaks based on index for smooth consistent look
    for (let i = 0; i < totalBars; i++) {
      const x = i * (barWidth + gap);
      // Realistic speech modulation envelope
      const env = 0.3 + 0.5 * Math.sin(i * 0.08) * Math.cos(i * 0.03);
      const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const magnitude = Math.max(0.15, Math.min(0.9, env * Math.abs(noise)));

      const barH = magnitude * (height - 6);
      const topY = midY - barH / 2;

      ctx.beginPath();
      ctx.roundRect(x, topY, barWidth, barH, 1.5);
      ctx.fill();
    }
  }, [duration, zoom, height, color]);

  const totalWidth = Math.max(800, duration * zoom);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${totalWidth}px`, height: `${height}px` }}
      className="pointer-events-none opacity-80"
    />
  );
}
