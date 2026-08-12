import { describe, expect, it } from 'vitest';
import { LatestRequestGuard } from './latest-request';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('LatestRequestGuard', () => {
  it('allows only the newest async request to commit after out-of-order completion', async () => {
    const guard = new LatestRequestGuard();
    const slow = deferred();
    const fast = deferred();
    let active = '';

    const run = async (name: string, waitFor: Promise<void>) => {
      const token = guard.begin();
      await waitFor;
      if (!guard.isCurrent(token)) return false;
      active = name;
      return true;
    };

    const older = run('old-pdf', slow.promise);
    const newer = run('new-pdf', fast.promise);

    fast.resolve();
    expect(await newer).toBe(true);
    expect(active).toBe('new-pdf');

    slow.resolve();
    expect(await older).toBe(false);
    expect(active).toBe('new-pdf');
  });

  it('invalidates the current request explicitly', () => {
    const guard = new LatestRequestGuard();
    const token = guard.begin();
    expect(guard.isCurrent(token)).toBe(true);
    guard.invalidate();
    expect(guard.isCurrent(token)).toBe(false);
  });
});
