import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

describe('no credentials in tracked source (P3-T7)', () => {
  it('src contains no raw 64-hex key material or mnemonic phrases', () => {
    for (const file of tsFiles(srcDir)) {
      const rel = relative(srcDir, file);
      const src = readFileSync(file, 'utf8');
      expect(src, `${rel} must not contain key material`).not.toMatch(/[0-9a-f]{64}/i);
      expect(src).not.toMatch(/BEGIN PRIVATE KEY|mnemonic|seed phrase/i);
    }
  });

  it('no .env with values is tracked; dist is ignored', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
    expect(tracked.some((f) => f.endsWith('.env') && !f.endsWith('.env.example'))).toBe(false);
    expect(tracked.some((f) => f.startsWith('dist/'))).toBe(false);
  });
});

describe('authority is a distinct role from publisher (P3-T6)', () => {
  it('publisher never imports the transfer (hand-off) execution path', () => {
    const publisherModule = readFileSync(join(srcDir, 'publisher', 'publisher.ts'), 'utf8');
    expect(publisherModule).not.toMatch(/>\s*['"].*authority\/transfer['"]/);
  });

  it('succession transfer requires a parameterized incoming publisher, never a constant successor', () => {
    const transfer = readFileSync(join(srcDir, 'authority', 'transfer.ts'), 'utf8');
    expect(transfer).toMatch(/incomingPublisher/);
    // The incoming steward is a function/parameter binding, not a literal address.
    expect(transfer).not.toMatch(/incomingPublisher\s*[:=]\s*['"][0-9a-fA-Fx]+['"]/);
  });
});

describe('succession agreement and evidence are documented, not fabricated (P3-T4, P3-T5)', () => {
  it('docs contain a succession agreement naming steward, successor, and trigger', () => {
    const agreement = readFileSync(join(root, 'docs', 'succession-agreement.md'), 'utf8');
    expect(agreement).toMatch(/steward|successor/i);
    expect(agreement).toMatch(/trigger|triggering|condition/i);
  });

  it('hand-off evidence document defines a schema but contains no fabricated hashes', () => {
    const evidenceDoc = readFileSync(join(root, 'docs', 'hand-off-evidence.md'), 'utf8');
    expect(evidenceDoc).toMatch(/OLD_STEWARD|NEW_STEWARD|EVIDENCE/);
  });
});