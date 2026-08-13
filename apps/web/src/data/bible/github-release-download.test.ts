import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseGitHubReleaseDownloadUrl,
  resolveBiblePackageDownloadSource,
} from './github-release-download';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHub Bible release download resolver', () => {
  it('parses the browser-facing release URL', () => {
    expect(
      parseGitHubReleaseDownloadUrl(
        'https://github.com/ThenGB/GYSApp-Data/releases/download/bibles-2026.05.21/b_kjv.gyspkg',
      ),
    ).toEqual({
      owner: 'ThenGB',
      repo: 'GYSApp-Data',
      tag: 'bibles-2026.05.21',
      fileName: 'b_kjv.gyspkg',
    });
  });

  it('resolves a public release asset through the GitHub REST API', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            assets: [
              {
                name: 'b_kjv.gyspkg',
                url: 'https://api.github.com/repos/ThenGB/GYSApp-Data/releases/assets/425916697',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const source = await resolveBiblePackageDownloadSource(
      'https://github.com/ThenGB/GYSApp-Data/releases/download/bibles-2026.05.21/b_kjv.gyspkg',
      new AbortController().signal,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/ThenGB/GYSApp-Data/releases/tags/bibles-2026.05.21',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(source).toEqual({
      url: 'https://api.github.com/repos/ThenGB/GYSApp-Data/releases/assets/425916697',
      headers: { Accept: 'application/octet-stream' },
    });
  });
});
