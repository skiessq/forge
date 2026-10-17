# Known Limitations & Technical Boundaries

In accordance with ClipForge's zero-placeholder policy, this document outlines known environment limitations, boundary conditions, and hardware considerations.

---

### 1. Offline & Local Speech-to-Text Constraints
- **Whisper Model Sizing**: ClipForge defaults to the `base` model in `faster-whisper` to maintain high speed and low memory footprint (~500MB RAM) on consumer CPUs without requiring a dedicated CUDA GPU.
- **Microphone / Live Dictation**: ClipForge performs offline batch transcription on the imported media file rather than live real-time mic streaming.
- **Audio Clarity**: Audio with severe background music distortion or multiple people speaking simultaneously may require manual edits in the transcript editor to correct word boundary alignments.

### 2. Hardware Encoding Fallbacks
- **GPU Acceleration**:
  - `h264_nvenc` requires an NVIDIA GPU with driver support.
  - `h264_videotoolbox` requires macOS.
  - `h264_qsv` requires Intel QuickSync hardware.
- **Automatic Fallback**: If hardware acceleration fails during filtergraph initialization (e.g. incompatible pixel format or busy GPU), the export pipeline automatically falls back to CPU `libx264` (`yuv420p`, `+faststart`).

### 3. Browser Preview vs. Native FFmpeg Export
- **Font Rendering**: Browser preview renders subtitles via CSS/DOM text styling, which depends on browser typography rendering engines. The final export uses native FFmpeg with `libass`, rendering true vector text directly onto the video raster. All dimensions, line wraps, and positions are synchronized via percentage math, but slight font anti-aliasing variations may be noticeable between the browser canvas and the encoded MP4.
- **Web Video Codecs**: Browsers support standard MP4 (H.264 / AAC) and WebM (VP8/VP9/AV1). If a user imports exotic formats (such as ProRes, MKV with FLAC, or HEVC with 10-bit color), the media server streams it, but the browser may require transcoding for real-time DOM preview. The native FFmpeg export engine handles all formats natively.

### 4. DRM & Network Download Limitations
- **Twitch Clip Availability**: `yt-dlp` fetches publicly accessible Twitch clip URLs. Private clips, deleted broadcasts, or clips behind paywalls/DRM cannot be ingested.
- **Network Interruptions**: If a Twitch download drops mid-stream, the job is marked as failed in the queue and the partial download is purged to prevent corrupted workspace source files.

### 5. Windows Filesystem Constraints
- **Drive Letter Colons in FFmpeg Filtergraphs**: On Windows, drive letters (e.g., `C:\`) inside FFmpeg filtergraph strings must have their colons escaped (`C\:/...`) to avoid collision with filter option delimiters. ClipForge automatically sanitizes and normalizes all paths passed to `subtitles='...'` and `movie='...'`.
- **MAX_PATH (260 Characters)**: Projects are stored under `.workspace/<projectId>/`. Avoid deeply nested directory structures on Windows systems where long paths are disabled in the registry.

### 6. Auto-Highlight & LLM Scoring Constraints
- **Local Ollama Integration**:
  - Running the local AI scoring engine requires [Ollama](https://ollama.com/) running on `http://127.0.0.1:11434` with an installed model (e.g., `ollama pull llama3.2`).
  - If Ollama is not installed or the daemon is inactive, ClipForge automatically detects the connection state and gracefully falls back to deterministic rule-based virality scoring, preventing runtime crashes.
- **CUDA Runtime DLLs**:
  - NVIDIA RTX GPUs (such as RTX 5050/4060/3060) accelerate `faster-whisper` transcription. If dynamic CUDA runtime DLLs (e.g. `cublas64_12.dll`) are missing from the environment, the transcription engine automatically catches the error and executes seamless fallback to high-speed CPU `int8` quantization.
- **Human-in-the-Loop Review**:
  - In strict compliance with zero-unauthorized-action policy, Auto-Highlight never auto-publishes or auto-approves clips. Every highlight candidate must be approved by the user before being dispatched to the editor.
- **Zero-Speech Segments**:
  - Videos with prolonged periods of dead air or music only are automatically detected and omitted by Stage 3 pre-filtering. Short videos (<5 min) automatically adapt minimum window constraints and reduce candidate counts proportionally.

