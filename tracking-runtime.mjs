export const MAX_SAMPLE_AGE_MS = 220;
export const TRACK_LOSS_MS = 280;

export function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null;
}

export class AdaptiveFrameQuality {
  constructor() {
    this.level = 0;
    this.samples = [];
    this.fastWindows = 0;
    this.slowWindows = 0;
    this.lastChange = -Infinity;
  }
  get width() { return [640, 480, 360][this.level]; }
  observe(age, at) {
    if (!Number.isFinite(age) || age < 0) return;
    this.samples.push(age);
    if (this.samples.length < 12) return;
    this.windowP95 = p95(this.samples);
    this.samples = [];
    this.slowWindows = this.windowP95 > 120 ? this.slowWindows + 1 : 0;
    this.fastWindows = this.windowP95 < 65 ? this.fastWindows + 1 : 0;
    const down = this.slowWindows >= 2 && this.level < 2 && at - this.lastChange >= 800;
    const up = this.fastWindows >= 5 && this.level > 0 && at - this.lastChange >= 5000;
    if (!down && !up) return;
    this.level += down ? 1 : -1;
    this.lastChange = at;
    this.fastWindows = this.slowWindows = 0;
  }
}

// The in-flight slot deliberately survives stop/start until the old promise
// settles. There is no pending queue and every callback has its own session token.
export class VideoInferenceScheduler {
  constructor(video, { prepare, run, onError, raf = requestAnimationFrame, caf = cancelAnimationFrame, clock = () => performance.now() }) {
    this.video = video;
    Object.assign(this, { prepare, run, onError, raf, caf, clock });
    this.native = typeof video.requestVideoFrameCallback === 'function' && typeof video.cancelVideoFrameCallback === 'function';
  }
  start() {
    if (this.session) return;
    this.lastFrame = undefined;
    this.session = {};
    this.schedule(this.session);
  }
  stop() {
    this.session = null;
    if (this.callbackId !== undefined) {
      if (this.native) this.video.cancelVideoFrameCallback(this.callbackId);
      else this.caf(this.callbackId);
    }
    this.callbackId = undefined;
  }
  schedule(session) {
    const tick = (_now, metadata) => {
      if (session !== this.session) return;
      this.schedule(session);
      const frame = metadata?.presentedFrames ?? this.video.currentTime;
      if (frame === this.lastFrame || this.video.readyState < 2) return;
      this.lastFrame = frame;
      if (this.inFlight) return;
      const payload = this.prepare();
      if (!payload) return;
      const job = { ...payload, submittedAt: this.clock(), session };
      this.inFlight = job;
      Promise.resolve().then(() => {
        if (this.isCurrent(job)) return this.run(job);
      }).catch(error => {
        if (this.isCurrent(job)) this.onError?.(error, job);
      }).finally(() => {
        if (this.inFlight === job) this.inFlight = null;
      });
    };
    this.callbackId = this.native ? this.video.requestVideoFrameCallback(tick) : this.raf(tick);
  }
  isCurrent(job) { return Boolean(job && this.session && this.inFlight === job && job.session === this.session); }
}

export class HandContinuity {
  reset() { this.lastGoodAt = undefined; this.identity = null; this.interrupted = false; }
  observe(now, ids) {
    if (!ids.length) {
      if (this.lastGoodAt === undefined || now - this.lastGoodAt > TRACK_LOSS_MS) {
        const firstLoss = this.identity != null;
        this.reset();
        return firstLoss ? 'lost' : 'waiting';
      }
      this.interrupted = true;
      return 'hold';
    }
    const identity = ids.join('/');
    const changed = this.identity != null && (this.identity !== identity || now - this.lastGoodAt > TRACK_LOSS_MS);
    const resumed = this.interrupted;
    this.identity = identity;
    this.lastGoodAt = now;
    this.interrupted = false;
    return changed ? 'changed' : resumed ? 'resumed' : 'tracking';
  }
}

// Interpolates only between measured positions; never extrapolates.
export class HandDisplayInterpolation {
  clear() { this.previous = this.current = null; }
  push(points, at) {
    this.previous = this.current ? this.read(at) : points;
    this.duration = this.current ? Math.min(45, Math.max(0, at - this.at)) : 0;
    this.current = points;
    this.at = at;
  }
  read(now) {
    if (!this.current || !this.duration) return this.current;
    const t = Math.max(0, Math.min(1, (now - this.at) / this.duration));
    if (t >= 1) return this.current;
    return this.current.map((p, i) => {
      const q = this.previous[i];
      return { ...p, x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t };
    });
  }
}
