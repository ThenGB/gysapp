export type BiblePackCode = 'b_tb' | 'b_kjv' | 'b_cuv';

export interface BiblePackPackage {
  code: BiblePackCode;
  version: string;
  fileName: string;
  downloadUrl: string;
  installFileName: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface BiblePackManifest {
  track: 'bibles';
  releaseTag: string;
  publishedAt: string;
  packages: BiblePackPackage[];
}

export type BiblePackAvailability =
  | 'built-in'
  | 'not-installed'
  | 'installed'
  | 'update-available';

const SUPPORTED_CODES = new Set<BiblePackCode>(['b_tb', 'b_kjv', 'b_cuv']);
const SHA256_RE = /^[a-f0-9]{64}$/i;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid Bible manifest field: ${field}`);
  }
  return value.trim();
}

function parsePackage(value: unknown): BiblePackPackage {
  if (!value || typeof value !== 'object') throw new Error('Invalid Bible manifest package');
  const item = value as Record<string, unknown>;
  const code = requiredString(item.code, 'packages[].code') as BiblePackCode;
  if (!SUPPORTED_CODES.has(code)) throw new Error(`Unsupported Bible pack: ${code}`);

  const downloadUrl = requiredString(item.downloadUrl, `${code}.downloadUrl`);
  const url = new URL(downloadUrl);
  if (url.protocol !== 'https:') throw new Error(`Bible pack must use HTTPS: ${code}`);

  const sizeBytes = Number(item.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error(`Invalid Bible pack size: ${code}`);
  }

  const checksumSha256 = requiredString(item.checksumSha256, `${code}.checksumSha256`);
  if (!SHA256_RE.test(checksumSha256)) throw new Error(`Invalid Bible pack SHA-256: ${code}`);

  return {
    code,
    version: requiredString(item.version, `${code}.version`),
    fileName: requiredString(item.fileName, `${code}.fileName`),
    downloadUrl,
    installFileName: requiredString(item.installFileName, `${code}.installFileName`),
    sizeBytes,
    checksumSha256: checksumSha256.toLowerCase(),
  };
}

export function parseBiblePackManifest(value: unknown): BiblePackManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid Bible manifest');
  const root = value as Record<string, unknown>;
  if (root.track !== 'bibles') throw new Error('Unexpected asset manifest track');
  if (!Array.isArray(root.packages)) throw new Error('Bible manifest packages must be an array');

  const packages = root.packages.map(parsePackage);
  const seen = new Set<string>();
  for (const item of packages) {
    if (seen.has(item.code)) throw new Error(`Duplicate Bible pack: ${item.code}`);
    seen.add(item.code);
  }

  return {
    track: 'bibles',
    releaseTag: requiredString(root.releaseTag, 'releaseTag'),
    publishedAt: requiredString(root.publishedAt, 'publishedAt'),
    packages,
  };
}

export function getBiblePack(
  manifest: BiblePackManifest,
  code: BiblePackCode,
): BiblePackPackage | undefined {
  return manifest.packages.find((item) => item.code === code);
}

export function biblePackAvailability(options: {
  code: BiblePackCode;
  builtIn?: boolean;
  installedChecksum?: string | null;
  remoteChecksum?: string | null;
}): BiblePackAvailability {
  const installed = options.installedChecksum?.toLowerCase() ?? null;
  const remote = options.remoteChecksum?.toLowerCase() ?? null;
  if (installed && remote && installed !== remote) return 'update-available';
  if (installed) return 'installed';
  if (options.builtIn) return 'built-in';
  return 'not-installed';
}
