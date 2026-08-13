export interface BiblePackageDownloadSource {
  url: string;
  headers?: Record<string, string>;
}

interface GitHubReleaseDownloadLocation {
  owner: string;
  repo: string;
  tag: string;
  fileName: string;
}

interface GitHubReleaseAsset {
  name?: unknown;
  url?: unknown;
}

interface GitHubReleaseResponse {
  assets?: GitHubReleaseAsset[];
}

const resolvedSources = new Map<string, BiblePackageDownloadSource>();

export function parseGitHubReleaseDownloadUrl(
  value: string,
): GitHubReleaseDownloadLocation | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 6 || parts[2] !== 'releases' || parts[3] !== 'download') return null;

  const owner = parts[0];
  const repo = parts[1];
  const tag = parts[4];
  const fileName = parts.slice(5).join('/');
  if (!owner || !repo || !tag || !fileName) return null;

  try {
    return {
      owner: decodeURIComponent(owner),
      repo: decodeURIComponent(repo),
      tag: decodeURIComponent(tag),
      fileName: decodeURIComponent(fileName),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve GitHub's browser-facing release URL through the public release API.
 * The binary request deliberately sends only a simple Accept header; keeping
 * the browser request minimal avoids unnecessary CORS preflight dependencies.
 */
export async function resolveBiblePackageDownloadSource(
  downloadUrl: string,
  signal: AbortSignal,
): Promise<BiblePackageDownloadSource> {
  const cached = resolvedSources.get(downloadUrl);
  if (cached) return cached;

  const location = parseGitHubReleaseDownloadUrl(downloadUrl);
  if (!location) return { url: downloadUrl };

  const owner = encodeURIComponent(location.owner);
  const repo = encodeURIComponent(location.repo);
  const tag = encodeURIComponent(location.tag);
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;

  try {
    const response = await fetch(releaseUrl, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return { url: downloadUrl };

    const release = (await response.json()) as GitHubReleaseResponse;
    const asset = release.assets?.find(
      (candidate) => candidate.name === location.fileName && typeof candidate.url === 'string',
    );
    if (!asset || typeof asset.url !== 'string') return { url: downloadUrl };

    const source: BiblePackageDownloadSource = {
      url: asset.url,
      headers: { Accept: 'application/octet-stream' },
    };
    resolvedSources.set(downloadUrl, source);
    return source;
  } catch (error) {
    if (signal.aborted) throw error;
    return { url: downloadUrl };
  }
}
