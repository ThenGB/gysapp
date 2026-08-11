import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseChordDocument, parseChordManifest, type ChordManifest } from '@gysapp/contracts';
import { sha256Hex } from '../../src/util/sha256';

const FIXTURES = fileURLToPath(new URL('../../../../tests/fixtures/chords', import.meta.url));

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(`${FIXTURES}/${name}`, 'utf8'));
}

async function sha256OfFile(file: string): Promise<string> {
  const data = new Uint8Array(await readFile(`${FIXTURES}/files/${file}`));
  return sha256Hex(data);
}

describe('chord fixtures integrity', () => {
  it('fixture manifest matches the pinned gyschordweb commit', async () => {
    const meta = (await readJson('fixture-meta.json')) as {
      pinnedManifestCommit: string;
      sourceCommit: string;
      fileCount: number;
    };
    expect(meta.pinnedManifestCommit).toBe('cbc7d386c9afed3f2e24549b13cefc0201408a94');
    expect(meta.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('manifest parses with the contract schema', async () => {
    const manifest = parseChordManifest(await readJson('assets-chord-manifest.json'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.files.length).toBeGreaterThan(100);
  });

  it('every manifest entry has a fixture file with matching sha256', async () => {
    const manifest = parseChordManifest(await readJson('assets-chord-manifest.json'));
    const files = new Set(await readdir(`${FIXTURES}/files`));
    let verified = 0;
    for (const entry of manifest.files) {
      const name = entry.path.split('/').pop() as string;
      const fixture = `${entry.id.replace(':', '_')}__${name}`;
      expect(files.has(fixture), `missing fixture for ${entry.id}`).toBe(true);
      const sha = await sha256OfFile(fixture);
      expect(sha).toBe(entry.sha256);
      verified += 1;
    }
    expect(verified).toBe(manifest.files.length);
  });

  it('every fixture chord file is a valid v2 note-aligned document', async () => {
    const manifest = parseChordManifest(await readJson('assets-chord-manifest.json'));
    for (const entry of manifest.files) {
      const name = entry.path.split('/').pop() as string;
      const fixture = `${entry.id.replace(':', '_')}__${name}`;
      const document = parseChordDocument(
        JSON.parse(await readFile(`${FIXTURES}/files/${fixture}`, 'utf8')),
      );
      expect(document.version).toBe(2);
      expect(document.type).toBe('note-aligned');
      expect(Object.keys(document.pages).length).toBeGreaterThan(0);
    }
  });
});

describe('chord manifest contract', () => {
  it('rejects unsupported schemas and malformed entries', async () => {
    const manifest = (await readJson('assets-chord-manifest.json')) as ChordManifest;
    expect(() => parseChordManifest({ ...manifest, schemaVersion: 2 })).toThrow();
    const broken = structuredClone(manifest);
    broken.files[0]!.sha256 = 'not-a-sha';
    expect(() => parseChordManifest(broken)).toThrow();
    const badId = structuredClone(manifest);
    badId.files[0]!.id = 'KR001';
    expect(() => parseChordManifest(badId)).toThrow();
  });
});
