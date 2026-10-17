# ClipForge 🎬

> **Local-First Studio to Turn Long Stream & Gameplay Clips into Viral 9:16 Vertical Videos**  
> Tailored for TikTok, Instagram Reels, and YouTube Shorts. Zero cloud dependencies, zero subscriptions, 100% private and offline on your computer.

---

## ⚖️ Content Rights & Fair Usage Notice

**ClipForge is designed strictly for footage the user is authorized to edit and publish** (e.g., footage supplied by a campaign, streams you own, gameplay recordings, or content used with express creator permission).

ClipForge **does not** include any features that obscure media provenance, evade platform fingerprinting or copyright detection, or fake engagement metrics. All editing and export operations preserve source integrity.

---

## ✨ Features

- **7 Dynamic Layout Templates (Data-Driven)**:
  1. *Gameplay Full Frame*: Smart crop to 9:16 vertical.
  2. *Split (Facecam Top / Gameplay Bottom)*: Two customizable regions with adjustable split ratio (30/70, 50/50, 70/30), divider lines, and corner radius.
  3. *Split (Gameplay Top / Facecam Bottom)*: Facecam on bottom, gameplay on top.
  4. *Media Top / Gameplay Bottom*: Loop an extra video, image, or GIF on top while game plays below.
  5. *Media Bottom / Gameplay Top*: Media slot on bottom, gameplay on top.
  6. *Blurred Background Fit*: Centered original clip over a zoomed, heavily blurred copy of the video.
  7. *Picture-in-Picture (PiP)*: Rounded facecam overlay floating above full-screen gameplay with custom borders and positioning.
- **Word-Level AI Subtitles & Karaoke Animation**:
  - Transcribe locally via `faster-whisper` (Python) with word timestamps.
  - Native ASS subtitle generation with karaoke tags (`\k`) for synchronized active word highlighting.
  - 5 viral presets: *Bold White*, *Yellow Highlight*, *Dark Boxed*, *Minimal Clean*, and *Cyber Neon*.
  - Import and export standard `.srt` and `.ass` files.
- **Untouched Audio by Default**:
  - Preserves original stream bitstream byte-for-byte by default (`-c:a copy` when format matches, or lossless pass-through).
  - Optional loudness normalization (`EBU R128` loudnorm).
  - Optional game audio ducking when voice speech is detected.
  - Non-destructive Silence Detection tool with interactive cut preview before applying.
- **Multi-Track Timeline**:
  - Dedicated Video, Audio (with waveform visualizer), Subtitle, and Overlay tracks.
  - Real-time playhead scrubbing, split (`S`), trim, ripple delete (`Del`), duplicate, and 50-step undo/redo (`Ctrl+Z`, `Ctrl+Shift+Z`).
- **Visual Effects & Hooks**:
  - Auto punch-in zoom detector suggesting cuts at the start of punchy sentences.
  - Customizable intro hook title card overlay for the first 1–3 seconds.
  - Watermark overlay with opacity and anchor positioning.
  - Interactive TikTok / Instagram Reels safe-zone guide overlay.
- **Project Presets & Batch Queue**:
  - Save full project configurations (layout + subtitles + hook + audio settings) as reusable templates.
  - Apply saved templates across multiple clips and queue them for batch export.
  - AI Auto-Split assistant to slice long gameplay clips into short-form candidates.
- **Hardware-Accelerated Export**:
  - Pure FFmpeg filtergraph generation.
  - Auto hardware encoding: NVIDIA NVENC (`h264_nvenc`), Apple VideoToolbox (`h264_videotoolbox`), Intel QuickSync (`h264_qsv`), with automatic fallback to high-quality `libx264`.
  - Output optimized for mobile playback (`yuv420p`, `+faststart`).

---

## 🛠️ System Prerequisites & Installation

ClipForge relies on three native local command-line tools:
1. **Node.js** (v18 or v20+)
2. **FFmpeg & FFprobe** (built with `libass` for subtitle burning and hardware acceleration support)
3. **yt-dlp** (for downloading Twitch clips)
4. **Python 3.10+ & faster-whisper** (for local speech-to-text transcription)

### 🪟 Windows Setup

1. **Install Node.js**:
   Download and install from [nodejs.org](https://nodejs.org/) or via `winget`:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Install FFmpeg (Gyan Essentials with libass & NVENC)**:
   ```powershell
   winget install Gyan.FFmpeg.Essentials
   ```
   *ClipForge automatically detects FFmpeg in both system `PATH` and WinGet package directories.*

3. **Install yt-dlp & faster-whisper**:
   ```powershell
   python -m pip install --upgrade pip
   python -m pip install yt-dlp faster-whisper
   ```

---

### 🍏 macOS Setup

1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js, FFmpeg, and yt-dlp**:
   ```bash
   brew install node ffmpeg yt-dlp
   ```
   *Homebrew's FFmpeg formula includes `libass` and Apple `videotoolbox` hardware acceleration by default.*

3. **Install faster-whisper**:
   ```bash
   pip3 install faster-whisper
   ```

---

### 🐧 Linux Setup (Ubuntu / Debian / Fedora / Arch)

1. **Ubuntu / Debian**:
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm ffmpeg python3-pip
   pip3 install yt-dlp faster-whisper
   ```

2. **Fedora**:
   ```bash
   sudo dnf install -y nodejs ffmpeg python3-pip
   pip3 install yt-dlp faster-whisper
   ```

3. **Arch Linux**:
   ```bash
   sudo pacman -S nodejs npm ffmpeg yt-dlp python-pip
   pip install faster-whisper
   ```

---

## 🚀 Running ClipForge

1. **Clone & Install Dependencies**:
   ```bash
   cd Forge
   npm install
   ```

2. **Run the Development Server**:
   - **Windows (1-Click)**: Simply double-click `start.bat` (or run `run.bat`). It will check requirements, launch the server, and automatically open [http://localhost:3000](http://localhost:3000) in your browser.
   - **Manual / macOS / Linux**:
     ```bash
     npm run dev
     ```
     Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Run Unit & E2E Tests**:
   ```bash
   npm test
   ```
   Executes all 14 unit and integration tests (filtergraph builder, ASS karaoke generator, timeline operations, project serialization, and full CI pipeline).

---

## 📂 Architecture & Data Model

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide Icons.
- **State Management**: `zustand` with full undo/redo action history in `src/store/useEditorStore.ts`.
- **Pure Functions**:
  - Filtergraph Builder: `src/lib/ffmpeg/builder.ts` transforms `Project` state into pure FFmpeg `-filter_complex` graphs.
  - Subtitle Generator: `src/lib/subtitles/assGenerator.ts` generates standard Advanced SubStation Alpha `.ass` files with karaoke tags (`\k<centiseconds>`).
  - Timeline Operations: `src/lib/timeline/operations.ts` handles non-destructive slicing, trimming, and ripple shifting.
- **Storage**: Local filesystem `.workspace/<projectId>/` containing `project.json`, `source.mp4`, `subtitles.ass`, and exported videos. No external database required.
- **Job Processing**: In-process SSE job queue in `src/lib/jobs/queue.ts` streaming real-time status and progress percentages to the UI.

---

## ⌨️ Timeline Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause Preview |
| `S` | Split selected clip at playhead position |
| `Delete` / `Backspace` | Ripple delete selected clip |
| `Ctrl + Z` | Undo last operation |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo undone operation |
| `Home` / `End` | Jump to start / end of timeline |

---

## 📄 License

ClipForge is distributed under the MIT License for personal, local creator workflows.
