type RecoverySnapshot = {
  time: number;
  wanted: boolean;
  healthy: boolean;
  failed: boolean;
};

type RecoveryOptions = {
  snapshot: () => RecoverySnapshot;
  retry: () => Promise<void>;
  exhausted: () => void;
  recovered: () => void;
  retryDelay?: (backoff: number) => number;
};

// A playing event alone does not replenish the budget: flaky connections can
// repeatedly emit it without delivering meaningful playback.
const RETRY_DELAYS = [1000, 3000, 6000];
const STABLE_PLAYBACK_SECONDS = 10;

export class VideoRecovery {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private generation = 0;
  private running = false;
  private queued: { generation: number; delay?: number } | null = null;
  private stableFrom: number | null = null;
  private options: RecoveryOptions;

  constructor(options: RecoveryOptions) {
    this.options = options;
  }

  cancel() {
    this.generation++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.stableFrom = null;
    this.queued = null;
  }

  reset() {
    this.cancel();
    this.attempts = 0;
  }

  progress(time: number) {
    const stableFrom = this.stableFrom;
    this.cancel();
    this.stableFrom = stableFrom;
    if (this.stableFrom === null || time < this.stableFrom) this.stableFrom = time;
    if (time - this.stableFrom >= STABLE_PLAYBACK_SECONDS) this.attempts = 0;
    this.options.recovered();
  }

  schedule(initialDelay?: number) {
    if (this.timer !== null) return;
    const snapshot = { ...this.options.snapshot() };
    if (!snapshot.wanted) return;
    if (this.running) {
      // A new failure can arrive after playing canceled the old generation,
      // while that generation's URL request is still settling.
      this.queued = { generation: this.generation, delay: initialDelay };
      return;
    }
    this.stableFrom = null;
    const generation = this.generation;
    const backoff = RETRY_DELAYS[Math.min(this.attempts, RETRY_DELAYS.length - 1)];
    const delay = initialDelay ?? this.options.retryDelay?.(backoff) ?? backoff;
    this.timer = setTimeout(async () => {
      this.timer = null;
      const current = this.options.snapshot();
      if (generation !== this.generation || !current.wanted) return;
      if (current.healthy || (!current.failed && current.time > snapshot.time + 0.1)) {
        this.options.recovered();
        return;
      }
      if (this.attempts >= RETRY_DELAYS.length) {
        this.options.exhausted();
        return;
      }
      this.attempts++;
      this.running = true;
      try {
        await this.options.retry();
      } catch {
        // The same bounded budget also covers failed URL refresh requests.
      } finally {
        this.running = false;
        const queued = this.queued;
        this.queued = null;
        if (queued && queued.generation === this.generation) this.schedule(queued.delay);
        else if (generation === this.generation) this.schedule();
      }
    }, delay);
  }
}
