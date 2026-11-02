/** How fast the camera AI is really running, as shown on the detection screen */
export interface PerfStats {
  /** Frames analysed per second */
  fps: number;
  /** Average time the model took per frame, in milliseconds */
  inferenceMs: number;
}

/** Stats are averaged over this window; older frames are forgotten */
const WINDOW_MS = 3000;

/** Measures analysed frames per second and model time from real timestamps (nothing assumed) */
export class PerfMeter {
  private samples: { t: number; ms: number }[] = [];

  reset() {
    this.samples = [];
  }

  record(inferenceMs: number, now = Date.now()) {
    this.samples.push({ t: now, ms: inferenceMs });
    this.prune(now);
  }

  snapshot(now = Date.now()): PerfStats {
    this.prune(now);
    const n = this.samples.length;
    if (n === 0) return { fps: 0, inferenceMs: 0 };
    const inferenceMs = this.samples.reduce((sum, s) => sum + s.ms, 0) / n;
    // Rate from the span between frames; a single frame says nothing about speed yet
    const spanSeconds = (this.samples[n - 1].t - this.samples[0].t) / 1000;
    const fps = n < 2 || spanSeconds <= 0 ? 0 : (n - 1) / spanSeconds;
    return { fps, inferenceMs };
  }

  private prune(now: number) {
    while (this.samples.length && now - this.samples[0].t > WINDOW_MS) this.samples.shift();
  }
}
