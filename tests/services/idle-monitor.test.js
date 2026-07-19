import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdleMonitor } from '../../src/services/idle-monitor.js';

describe('IdleMonitor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits input when idle time drops (user touched the machine)', () => {
    let idle = 10;
    const powerMonitor = { getSystemIdleTime: () => idle };
    const mon = new IdleMonitor({ powerMonitor, pollMs: 1000 });
    const onInput = vi.fn();
    mon.on('input', onInput);
    mon.start();
    idle = 11; vi.advanceTimersByTime(1000); // still rising -> no input
    idle = 0;  vi.advanceTimersByTime(1000); // dropped -> input
    mon.stop();
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('does not emit after stop', () => {
    let idle = 5;
    const powerMonitor = { getSystemIdleTime: () => idle };
    const mon = new IdleMonitor({ powerMonitor, pollMs: 1000 });
    const onInput = vi.fn();
    mon.on('input', onInput);
    mon.start();
    mon.stop();
    idle = 0; vi.advanceTimersByTime(5000);
    expect(onInput).not.toHaveBeenCalled();
  });
});
