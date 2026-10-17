'use client';

import React from 'react';
import { Heart, MessageCircle, Share2, Music, Bookmark } from 'lucide-react';

interface Props {
  visible: boolean;
}

export default function SafeZoneGuide({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden select-none">
      {/* Semi-transparent safe zone bounding box */}
      <div className="absolute inset-x-4 top-16 bottom-28 border border-dashed border-amber-400/40 rounded-xl" />

      {/* Top Header UI Simulation */}
      <div className="absolute top-4 inset-x-0 flex justify-center items-center gap-6 text-white/50 text-[11px] font-bold tracking-wider">
        <span>FOLLOWING</span>
        <span className="text-white border-b-2 border-white pb-0.5">FOR YOU</span>
      </div>

      {/* Right Platform Buttons Simulation (TikTok / Reels icons) */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white/70">
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-white/80 text-transparent" />
          </div>
          <span className="text-[10px] font-bold">128K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white/90" />
          </div>
          <span className="text-[10px] font-bold">1.4K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-white/20 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-white/90" />
          </div>
          <span className="text-[10px] font-bold">9.2K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-slate-800/80 backdrop-blur border border-white/20 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white/90" />
          </div>
          <span className="text-[10px] font-bold">Share</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-white/40 flex items-center justify-center animate-spin">
          <Music className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Bottom Description & Account Area Simulation */}
      <div className="absolute bottom-6 left-4 right-16 space-y-1 text-white/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-white">@streamer_clipping</span>
          <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-bold text-white">Follow</span>
        </div>
        <p className="text-[11px] text-white/90 line-clamp-2">
          Insane clutch play! Drop a like and follow for more daily gaming shorts #gaming #twitch #clip
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/60">
          <Music className="w-3 h-3" />
          <span>Original sound - streamer_clipping</span>
        </div>
      </div>

      {/* Safe Area Label */}
      <div className="absolute top-16 left-6 px-2 py-0.5 rounded bg-amber-500/80 text-[10px] font-bold text-black tracking-wide">
        TIKTOK / REELS SAFE ZONE
      </div>
    </div>
  );
}
