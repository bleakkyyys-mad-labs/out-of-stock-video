# The analyzer chain of the creator's Final Cut audio-visualizer plugin, as functions any stem
# can go through. Moved verbatim out of synth-spectrum.py (9/27) when the lead vocal needed the same chain;
# synth-spectrum.py's output is byte-identical through it (checked by md5 at the move).
#
# The spectrum: a Hamming-windowed FFT, magnitudes / fftSize, bands with the plugin's inverse-loudness gain and empty-band
# interpolation, attack/decay smoothing on the magnitudes, then dB -> noise floor / max -> gamma = the "shaped" value
# the plugin's bars use. Two changes, both on the plugin's doc's own future-work list: LOGARITHMIC bands (the plugin's doc: "Future enhancement:
# logarithmic binning"), and stereo averaged (the creator's reads the left channel only). Precomputed per video frame, so every
# frame of the render is a pure function of time (a live analyser can't be).
#
# Also here: the pitch of a voice (YIN), which the plugin's analyzer never had.
import base64
import numpy as np
import soundfile as sf


def load_mono(path):
    x, sr = sf.read(path, dtype="float32")
    return (x.mean(axis=1) if x.ndim == 2 else x), sr


class Framer:
    """windowed frames centred on given times, over the signal padded with n_fft zeros each side"""
    def __init__(self, x, sr, n_fft):
        self.sr, self.n_fft = sr, n_fft
        self.pad = np.concatenate([np.zeros(n_fft, np.float32), x, np.zeros(n_fft, np.float32)])

    def at(self, times, n, w):
        idx = (np.asarray(times) * self.sr).astype(np.int64) + self.n_fft - n // 2
        return self.pad[idx[:, None] + np.arange(n)[None, :]] * w


def loud_gain(f):
    """the plugin's inverse-loudness gain at a band's centre frequency"""
    if f < 200: return 0.1 + 0.4 * f / 200                      # heavy bass attenuation
    if f < 2000: return 0.5 + 0.5 * (f - 200) / 1800             # up to the ear's reference
    return 1.0 + 2.0 * min(1.0, (f - 2000) / 18000)             # a moderate lift in the highs


def band_spectrum(fr, nfr, fps, bands=48, f_lo=90.0, f_hi=16000.0, attack=0.0, decay=0.55, gamma=2.0, range_db=48.0):
    """the shaped band values per video frame (uint8, nfr x bands), and the dB max / floor they were shaped against"""
    n_fft, sr = fr.n_fft, fr.sr
    win = np.hamming(n_fft).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    edges = f_lo * (f_hi / f_lo) ** (np.arange(bands + 1) / bands)
    centre = np.sqrt(edges[:-1] * edges[1:])
    gain = np.array([loud_gain(f) for f in centre], np.float32)
    members = [np.where((freqs >= lo) & (freqs < hi))[0] for lo, hi in zip(edges[:-1], edges[1:])]
    mags = np.zeros((nfr, bands), np.float32)
    CH = 2000
    for s in range(0, nfr, CH):
        ts = np.arange(s, min(nfr, s + CH)) / fps
        spec = np.abs(np.fft.rfft(fr.at(ts, n_fft, win), axis=1)).astype(np.float32) / n_fft
        for b, m in enumerate(members):
            if len(m): mags[s:s + len(ts), b] = spec[:, m].mean(axis=1)
            else:      # an empty band (a log band narrower than a bin): the spectrum read at its centre (the plugin's interpolation)
                mags[s:s + len(ts), b] = np.array([np.interp(centre[b], freqs, row) for row in spec])
    mags *= gain
    # attack / decay on the magnitudes, frame to frame (the plugin's semantics: new = prev + (cur - prev) * (1 - k); 0 = instant)
    sm = np.zeros_like(mags)
    prev = np.zeros(bands, np.float32)
    for i in range(nfr):
        cur = mags[i]
        k = np.where(cur > prev, 1 - attack, 1 - decay)
        prev = prev + (cur - prev) * k
        sm[i] = prev
    db = 20 * np.log10(sm + 1e-12)
    max_db = float(np.percentile(db, 99.7))                     # max = the 99.7th percentile of the song's band levels
    floor_db = max_db - range_db
    shaped = np.clip((db - floor_db) / (max_db - floor_db), 0, 1) ** gamma
    return np.round(shaped * 255).astype(np.uint8), max_db, floor_db


def loudness(fr, nfr, fps):
    """RMS over one frame's worth, centred: dBFS per frame, and 0..1 on -60..-15 dBFS as uint8"""
    sr, pad, n_fft = fr.sr, fr.pad, fr.n_fft
    hop = sr // fps
    rms_db = np.array([20 * np.log10(np.sqrt(np.mean(pad[int(t * sr) + n_fft - hop: int(t * sr) + n_fft + hop] ** 2)) + 1e-9)
                       for t in np.arange(nfr) / fps])
    env = np.clip((rms_db - (-60.0)) / 45.0, 0, 1)
    return rms_db, np.round(env * 255).astype(np.uint8)


def yin_midi(x, sr, fps=100, fmin=70.0, fmax=1100.0, n=2048, floor_db=-42.0, voiced=0.5, near=0.03):
    """the pitch of a voice per frame, as a MIDI note (float), 0 where it isn't singing.
    YIN (de Cheveigne & Kawahara 2002): the cumulative-mean-normalised difference function, and the SMALLEST lag among
    its dips within `near` of the global minimum (the plain first-dip-under-a-threshold rule loses a strained or
    breathy note: measured on step 27's held vowel, whose crack into head voice reads 0.24-0.44 against a 0.15
    threshold, and a looser threshold picks the octave above; so does `near` 0.08, where the half-lag dip sits 0.07
    over the true one). Parabolic interpolation on the chosen dip, an octave-slip pass against the neighbours, then a
    5-frame median in MIDI (not across silence)."""
    tmin, tmax = int(sr / fmax), int(sr / fmin)
    pad = np.concatenate([np.zeros(n, np.float32), x, np.zeros(n + tmax, np.float32)])
    nfr = int(len(x) / sr * fps) + 1
    out = np.zeros(nfr, np.float32)
    lags = np.arange(1, tmax + 1)
    for i in range(nfr):
        c = int(i / fps * sr) + n - n // 2
        seg = pad[c:c + n + tmax].astype(np.float64)
        a = seg[:n]
        if 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9) < floor_db: continue
        # difference function via one FFT correlation: d(tau) = sum a^2 + sum b_tau^2 - 2 r(tau)
        L = 1 << int(np.ceil(np.log2(n + tmax + n)))
        r = np.fft.irfft(np.fft.rfft(seg, L) * np.conj(np.fft.rfft(a, L)), L)[1:tmax + 1]
        e0 = np.dot(a, a)
        cs = np.cumsum(seg ** 2)
        eb = cs[lags + n - 1] - cs[lags - 1]
        d = np.maximum(e0 + eb - 2 * r, 0)
        cm = d * lags / np.maximum(np.cumsum(d), 1e-12)
        lo = tmin - 1
        seg_cm = cm[lo:]
        gmin = seg_cm.min()
        if gmin > voiced: continue
        dips = [k for k in range(1, len(seg_cm) - 1) if seg_cm[k] <= seg_cm[k - 1] and seg_cm[k] <= seg_cm[k + 1] and seg_cm[k] <= gmin + near]
        k = dips[0] if dips else int(seg_cm.argmin())
        if 0 < k < len(seg_cm) - 1:
            p, q, s = seg_cm[k - 1], seg_cm[k], seg_cm[k + 1]
            k = k + 0.5 * (p - s) / (p - 2 * q + s + 1e-12)
        tau = k + lo + 1
        out[i] = 69 + 12 * np.log2(sr / tau / 440.0)
    # octave slips: a frame more than 9 semitones from the median of its voiced neighbours (+-70 ms) that lands nearer
    # one or two octaves over is moved by those octaves (a consonant's few voiced frames read two octaves up without
    # it; a genuine jump, like the held vowel's crack into head voice, is +8 and survives)
    for _ in range(2):
        fix = out.copy()
        for i in range(nfr):
            if out[i] == 0: continue
            nb = np.concatenate([out[max(0, i - 7):i], out[i + 1:i + 8]])
            nb = nb[nb > 0]
            if len(nb) < 3: continue
            ref = np.median(nb)
            for k in (-24, -12, 12, 24):
                if abs(out[i] - ref) > 9 and abs(out[i] + k - ref) < abs(fix[i] - ref): fix[i] = out[i] + k
        out = fix
    sm = out.copy()
    for i in range(nfr):
        if out[i] == 0: continue
        w = out[max(0, i - 2):i + 3]
        w = w[w > 0]
        sm[i] = np.median(w)
    return sm


b64 = lambda a: base64.b64encode(a.tobytes()).decode("ascii")
