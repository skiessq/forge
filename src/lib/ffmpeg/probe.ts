import { execSync } from 'child_process';
import { findExecutable } from './systemCheck';
import { MediaProbe, AudioTrackInfo } from '../types';

export function probeMedia(filePath: string): MediaProbe {
  const ffprobeExe = findExecutable('ffprobe');
  const cmd = `"${ffprobeExe}" -v quiet -print_format json -show_format -show_streams "${filePath}"`;

  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(stdout);

    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
    const audioStreams = data.streams?.filter((s: any) => s.codec_type === 'audio') || [];

    // Extract FPS
    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round(Number(parts[0]) / Number(parts[1]));
      }
    } else if (videoStream?.avg_frame_rate) {
      const parts = videoStream.avg_frame_rate.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round(Number(parts[0]) / Number(parts[1]));
      }
    }

    const duration = Number(videoStream?.duration || data.format?.duration || 0);
    const width = Number(videoStream?.width || 1920);
    const height = Number(videoStream?.height || 1080);
    const bitrate = Number(data.format?.bit_rate || 5000000);

    const audioTracks: AudioTrackInfo[] = audioStreams.map((s: any, idx: number) => ({
      index: idx,
      title: s.tags?.title || s.tags?.handler_name || `Audio Track ${idx + 1}`,
      language: s.tags?.language || 'und',
      channels: Number(s.channels || 2),
      codec: s.codec_name || 'aac',
    }));

    return {
      width,
      height,
      duration,
      fps: isNaN(fps) || fps <= 0 ? 30 : fps,
      codec: videoStream?.codec_name || 'unknown',
      bitrate,
      hasAudio: audioStreams.length > 0,
      audioCodec: audioStreams[0]?.codec_name,
      audioChannels: audioStreams[0]?.channels,
      audioTracks,
    };
  } catch (error) {
    console.error(`ffprobe error on ${filePath}:`, error);
    // Return sensible fallback probe if probing fails
    return {
      width: 1920,
      height: 1080,
      duration: 10,
      fps: 30,
      codec: 'unknown',
      bitrate: 4000000,
      hasAudio: true,
      audioCodec: 'aac',
      audioChannels: 2,
      audioTracks: [{ index: 0, title: 'Default Audio', language: 'und', channels: 2, codec: 'aac' }],
    };
  }
}
