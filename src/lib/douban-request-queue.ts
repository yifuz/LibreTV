interface QueueOptions {
  intervalMs?: number;
  maxPending?: number;
  maxWaitMs?: number;
}

/** 不同推荐请求也共用串行队列；只限制真实上游请求，缓存命中无需排队。 */
export class DoubanRequestQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private nextStart = 0;

  constructor(private options: QueueOptions = {}) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.pending >= (this.options.maxPending ?? 32)) throw new Error('推荐请求较多，请稍后重试');
    this.pending++;
    const queuedAt = Date.now();
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    try {
      await previous;
      const delay = Math.max(0, this.nextStart - Date.now());
      if (Date.now() + delay - queuedAt > (this.options.maxWaitMs ?? 30_000)) throw new Error('推荐请求排队超时，请稍后重试');
      if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      this.nextStart = Date.now() + (this.options.intervalMs ?? 1000);
      return await task();
    } finally {
      this.pending--;
      release();
    }
  }
}

const globals = globalThis as typeof globalThis & { __libretvDoubanQueue?: DoubanRequestQueue };
export const doubanRequestQueue = globals.__libretvDoubanQueue ??= new DoubanRequestQueue();
