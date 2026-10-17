import fs from 'fs';
import path from 'path';
import { LayoutConfig, SubtitleStyle, IntroHookConfig, WatermarkConfig, AudioSettings } from '../types';

export interface ProjectTemplate {
  id: string;
  name: string;
  createdAt: string;
  layout: LayoutConfig;
  subtitleStyle: SubtitleStyle;
  introHook?: {
    enabled: boolean;
    text: string;
    duration: number;
    fontSize: number;
    color: string;
  };
  watermark?: {
    enabled: boolean;
    opacity: number;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    scale: number;
  };
  audioSettings?: AudioSettings;
}

const TEMPLATES_FILE = path.resolve(process.cwd(), '.workspace', 'templates.json');

export function listTemplates(): ProjectTemplate[] {
  if (!fs.existsSync(TEMPLATES_FILE)) return [];
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTemplate(template: ProjectTemplate): void {
  const templates = listTemplates().filter((t) => t.id !== template.id);
  templates.push(template);
  const dir = path.dirname(TEMPLATES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
}

export function deleteTemplate(id: string): boolean {
  const templates = listTemplates();
  const next = templates.filter((t) => t.id !== id);
  if (next.length !== templates.length) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return true;
  }
  return false;
}
