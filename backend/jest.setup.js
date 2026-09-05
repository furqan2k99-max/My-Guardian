/**
 * Test environment setup.
 *
 * All jest suites run against a DEDICATED test database so their aggressive
 * cleanup (deleteMany on every table) can never touch local development data
 * — users, links, and device tokens you've paired with on the emulator stay
 * safe while tests run.
 *
 * One-time setup (run from backend/):
 *   $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=public'
 *   npx prisma migrate deploy
 *
 * dotenv does not override variables that are already set, so this value wins
 * over the .env file inside test runs.
 */
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/myguardian_test?schema=public';

process.env.LOG_LEVEL = 'silent';

// mp3/m4a tests need host ffmpeg. A freshly winget-installed ffmpeg is not on
// THIS process's PATH (PATH changes only reach new shells), so pick up the
// standard winget location if present. CI/production should put ffmpeg on
// PATH normally instead of relying on this.
const fs = require('node:fs');
const path = require('node:path');
const wingetPackages = path.join(
  process.env.LOCALAPPDATA ?? '',
  'Microsoft',
  'WinGet',
  'Packages',
);
try {
  for (const pkg of fs.readdirSync(wingetPackages)) {
    if (!pkg.toLowerCase().startsWith('gyan.ffmpeg')) continue;
    const pkgDir = path.join(wingetPackages, pkg);
    for (const build of fs.readdirSync(pkgDir)) {
      const bin = path.join(pkgDir, build, 'bin');
      if (fs.existsSync(path.join(bin, 'ffmpeg.exe'))) {
        process.env.Path = `${process.env.Path};${bin}`;
      }
    }
  }
} catch {
  /* no winget package dir — ffmpeg must already be on PATH */
}
