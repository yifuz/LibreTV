import { afterEach, describe, expect, it, vi } from 'vitest';
import { DoubanRequestQueue } from './douban-request-queue';

afterEach(() => vi.useRealTimers());

describe('Douban request pacing', () => {
  it('runs one upstream request at a time with at least one second between starts', async () => {
    vi.useFakeTimers();
    const queue = new DoubanRequestQueue();
    const starts: number[] = [];
    let active = 0;
    let maximumActive = 0;
    const requests = Array.from({ length: 4 }, () => queue.run(async () => {
      starts.push(Date.now());
      maximumActive = Math.max(maximumActive, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      active--;
    }));
    await vi.runAllTimersAsync();
    await Promise.all(requests);
    expect(maximumActive).toBe(1);
    expect(starts).toHaveLength(4);
    expect(starts.slice(1).every((time, i) => time - starts[i] >= 1000)).toBe(true);
  });

  it('spaces fast requests, releases failures, and rejects excess queue entries', async () => {
    vi.useFakeTimers();
    const queue = new DoubanRequestQueue({ maxPending: 2 });
    const starts: number[] = [];
    const first = queue.run(async () => { starts.push(Date.now()); throw new Error('offline'); });
    const rejected = expect(first).rejects.toThrow('offline');
    const second = queue.run(async () => { starts.push(Date.now()); return 'ok'; });
    await expect(queue.run(async () => 'excess')).rejects.toThrow('请求较多');
    await vi.runAllTimersAsync();
    await rejected;
    expect(await second).toBe('ok');
    expect(starts[1] - starts[0]).toBe(1000);
  });

  it('drops requests that waited beyond the queue deadline without calling upstream', async () => {
    vi.useFakeTimers();
    const queue = new DoubanRequestQueue({ maxWaitMs: 500 });
    const first = queue.run(async () => 'ok');
    const task = vi.fn();
    const second = expect(queue.run(task)).rejects.toThrow('排队超时');
    await vi.runAllTimersAsync();
    await first;
    await second;
    expect(task).not.toHaveBeenCalled();
  });
});
