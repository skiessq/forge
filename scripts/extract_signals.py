import sys
import json
import math
import wave
import numpy as np

def compute_audio_signals(wav_path, target_duration=None):
    try:
        with wave.open(wav_path, 'rb') as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            
            raw_data = wf.readframes(n_frames)
            
        if sampwidth == 2:
            dtype = np.int16
            max_val = 32767.0
        elif sampwidth == 4:
            dtype = np.int32
            max_val = 2147483647.0
        else:
            dtype = np.uint8
            max_val = 255.0

        audio = np.frombuffer(raw_data, dtype=dtype)
        if channels > 1:
            audio = audio.reshape(-1, channels).mean(axis=1)

        total_seconds = int(math.ceil(len(audio) / framerate))
        if target_duration is not None:
            total_seconds = max(total_seconds, int(math.ceil(target_duration)))

        # Pad to full seconds
        total_samples = total_seconds * framerate
        if len(audio) < total_samples:
            audio = np.pad(audio, (0, total_samples - len(audio)))
        else:
            audio = audio[:total_samples]

        # Reshape to (total_seconds, framerate)
        seconds_matrix = audio.reshape(total_seconds, framerate).astype(np.float32)

        # RMS per second
        rms = np.sqrt(np.mean(seconds_matrix**2, axis=1))
        # Convert to dB relative to full scale
        epsilon = 1e-5
        rms_db = 20.0 * np.log10(np.maximum(rms, epsilon) / max_val)

        # Rolling average RMS over 11 seconds (5s before, current, 5s after)
        pad_size = 5
        padded_rms = np.pad(rms_db, (pad_size, pad_size), mode='edge')
        rolling_avg = np.convolve(padded_rms, np.ones(11) / 11.0, mode='valid')

        # Spikes: difference between instantaneous RMS and local rolling average
        spikes = np.maximum(0.0, rms_db - rolling_avg)

        # Silence ratio: fraction of 100ms sub-windows below -38 dB
        sub_window_size = int(framerate * 0.1) # 100ms
        num_sub = framerate // sub_window_size
        sub_matrix = seconds_matrix[:, :num_sub * sub_window_size].reshape(total_seconds, num_sub, sub_window_size)
        sub_rms = np.sqrt(np.mean(sub_matrix**2, axis=2))
        sub_db = 20.0 * np.log10(np.maximum(sub_rms, epsilon) / max_val)
        silence_ratios = np.mean(sub_db < -38.0, axis=1)

        result = {
            "duration": total_seconds,
            "averageRmsDb": round(float(np.mean(rms_db)), 2),
            "seconds": [
                {
                    "second": i,
                    "rmsDb": round(float(rms_db[i]), 2),
                    "spike": round(float(spikes[i]), 2),
                    "silenceRatio": round(float(silence_ratios[i]), 2),
                }
                for i in range(total_seconds)
            ]
        }

        print(json.dumps(result))

    except Exception as e:
        print(f"Error computing audio signals: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_signals.py <audio_wav_path> [target_duration]", file=sys.stderr)
        sys.exit(1)

    wav_file = sys.argv[1]
    dur = float(sys.argv[2]) if len(sys.argv) > 2 else None
    compute_audio_signals(wav_file, dur)
