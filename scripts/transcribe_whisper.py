import sys
import json
import os
import time

# Ensure Windows finds cuBLAS and cuDNN DLLs from PyTorch if installed
try:
    import torch
    torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
    if os.path.exists(torch_lib):
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(torch_lib)
        os.environ["PATH"] = torch_lib + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

def transcribe(audio_path, language=None, model_size="small"):
    try:
        from faster_whisper import WhisperModel
        import ctranslate2
        
        # Check CUDA (NVIDIA RTX GPU) or CPU
        device = "cpu"
        compute_type = "int8"
        try:
            if ctranslate2.get_cuda_device_count() > 0:
                device = "cuda"
                compute_type = "float16"
        except Exception as e:
            print(f"CUDA check notice: {e}, falling back to CPU", file=sys.stderr)

        print(f"Selected device: {device} ({compute_type})", file=sys.stderr)

        # Map model aliases to Hugging Face repos if applicable
        model_aliases = {
            "turbo": "large-v3-turbo",
        }
        target_model = model_aliases.get(model_size, model_size)

        print(f"Loading faster-whisper model '{target_model}' on {device} ({compute_type})...", file=sys.stderr)
        
        model = None
        candidates = [target_model]
        if target_model not in ("small", "base"):
            candidates.append("small")
        if target_model != "base":
            candidates.append("base")

        for cand in candidates:
            try:
                print(f"Attempting to load model '{cand}' on {device}...", file=sys.stderr)
                model = WhisperModel(cand, device=device, compute_type=compute_type)
                print(f"Successfully loaded '{cand}' on {device}!", file=sys.stderr)
                break
            except Exception as load_err:
                print(f"Failed to load '{cand}' on {device}: {load_err}", file=sys.stderr)

        if model is None:
            # Fallback to CPU int8
            print("Falling back to 'base' on CPU...", file=sys.stderr)
            device = "cpu"
            compute_type = "int8"
            model = WhisperModel("base", device="cpu", compute_type="int8")

        # Try GPU BatchedInferencePipeline for high-throughput batching
        batched_pipeline = None
        if device == "cuda":
            try:
                from faster_whisper import BatchedInferencePipeline
                batched_pipeline = BatchedInferencePipeline(model=model)
                print("Initialized BatchedInferencePipeline (batch_size=16) for Tensor Core GPU inference!", file=sys.stderr)
            except Exception as batch_err:
                print(f"BatchedInferencePipeline unavailable ({batch_err}), using standard pipeline", file=sys.stderr)

        transcribe_kwargs = dict(
            language=language if language and language != "auto" else None,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400, speech_pad_ms=300),
            condition_on_previous_text=False,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            no_speech_threshold=0.6,
        )

        print(f"Transcribing '{audio_path}' (language={language or 'auto'}, device={device})...", file=sys.stderr)
        t_start = time.time()

        segments_iter = None
        info = None

        if batched_pipeline is not None:
            try:
                segments_iter, info = batched_pipeline.transcribe(
                    audio_path,
                    batch_size=16,
                    **transcribe_kwargs
                )
            except Exception as b_err:
                print(f"Batched transcription failed ({b_err}), falling back to standard transcribe...", file=sys.stderr)

        if segments_iter is None:
            try:
                segments_iter, info = model.transcribe(audio_path, **transcribe_kwargs)
            except Exception as std_err:
                if device == "cuda":
                    print(f"GPU transcribe error ({std_err}), falling back to CPU 'small'...", file=sys.stderr)
                    device = "cpu"
                    model = WhisperModel("small", device="cpu", compute_type="int8")
                    segments_iter, info = model.transcribe(audio_path, **transcribe_kwargs)
                else:
                    raise std_err

        detected_language = getattr(info, 'language', 'en')
        total_duration = getattr(info, 'duration', 0.0)
        if not total_duration or total_duration <= 0:
            try:
                import soundfile as sf
                f_info = sf.info(audio_path)
                total_duration = f_info.duration
            except Exception:
                pass

        print(f"Detected language: {detected_language}, total audio: {total_duration:.1f}s", file=sys.stderr)

        results = []
        seg_idx = 1
        last_progress_time = 0

        for segment in segments_iter:
            words = []
            if segment.words:
                for w in segment.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                    })

            results.append({
                "id": f"sub_{seg_idx}",
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip(),
                "words": words,
            })
            seg_idx += 1

            # Periodically stream PROGRESS line for real-time progress updates
            now = time.time()
            if now - last_progress_time > 0.3:
                last_progress_time = now
                pct = round((segment.end / total_duration * 100), 1) if total_duration > 0 else 50
                speed = round(segment.end / max(0.5, now - t_start), 1)
                print(f"PROGRESS:{segment.end:.1f}:{total_duration:.1f}:{pct}:{speed}", flush=True)
                sys.stdout.flush()

        elapsed = time.time() - t_start
        speedup = round(total_duration / max(0.5, elapsed), 1) if total_duration > 0 else 0
        print(f"Transcription finished in {elapsed:.1f}s ({speedup}x realtime speed)!", file=sys.stderr)

        output = {
            "language": detected_language,
            "segments": results,
        }
        # Output clean JSON with prefix for robust parsing
        print("FINAL_RESULT:" + json.dumps(output), flush=True)

    except Exception as e:
        print(f"Error in whisper transcription: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_whisper.py <audio_path> [language] [model_size]", file=sys.stderr)
        sys.exit(1)

    audio_file = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else None
    model = sys.argv[3] if len(sys.argv) > 3 else "large-v3-turbo"

    transcribe(audio_file, lang, model)
