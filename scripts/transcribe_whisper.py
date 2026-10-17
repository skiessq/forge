import sys
import json
import os

def transcribe(audio_path, language=None, model_size="base"):
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

        print(f"Loading faster-whisper model '{model_size}' on {device} ({compute_type})...", file=sys.stderr)
        try:
            model = WhisperModel(model_size, device=device, compute_type=compute_type)
            print(f"Transcribing '{audio_path}' (language={language or 'auto'})...", file=sys.stderr)
            segments, info = model.transcribe(
                audio_path,
                language=language if language and language != "auto" else None,
                word_timestamps=True,
                vad_filter=True,
            )
            detected_language = info.language
            segments_list = list(segments)
        except Exception as runtime_err:
            if device == "cuda":
                print(f"CUDA runtime notice ({runtime_err}), falling back to CPU int8...", file=sys.stderr)
                device = "cpu"
                compute_type = "int8"
                model = WhisperModel(model_size, device="cpu", compute_type="int8")
                print(f"Transcribing '{audio_path}' on CPU (language={language or 'auto'})...", file=sys.stderr)
                segments, info = model.transcribe(
                    audio_path,
                    language=language if language and language != "auto" else None,
                    word_timestamps=True,
                    vad_filter=True,
                )
                detected_language = info.language
                segments_list = list(segments)
            else:
                raise runtime_err

        print(f"Detected language: {detected_language} (prob: {info.language_probability:.2f})", file=sys.stderr)

        results = []
        seg_idx = 1

        for segment in segments_list:
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

        output = {
            "language": detected_language,
            "segments": results,
        }
        print(json.dumps(output))

    except Exception as e:
        # Fallback if model download or runtime error
        print(f"Error in whisper transcription: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_whisper.py <audio_path> [language] [model_size]", file=sys.stderr)
        sys.exit(1)

    audio_file = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else None
    model = sys.argv[3] if len(sys.argv) > 3 else "base"

    transcribe(audio_file, lang, model)
