// KESTREL RUN - submission builder (Node 22, no dependencies).
//
// Gathers the entry for the make.fun grader: the playable game/ folder and the screenshots/ folder that
// sit next to this file are copied into the output directory, and dossier.json (the summary the judge
// reads) is generated there by the kit's vendored buildDossier.
//
// The output directory is /output inside the grader. Locally, point MAKEFUN_OUTPUT_DIR elsewhere:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play the game itself: node serve.ts, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const target = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Limits the scorer enforces; buildDossier refuses an entry that breaks one, and trims its text to the cap.
const limits = {
  text_max_bytes: 163840, // dossier text budget (UTF-8 bytes)
  screenshots: { max: 4, max_bytes: 262144 }, // at most 4 images, 256 KiB each
  game_max_files: 993,
  game_max_bytes: 50331648, // 48 MiB of game files in total
  game_path_max_bytes: 1000,
};

/** Copy one folder from beside this file into the output, creating the destination either way. */
function bring(name: string, required: boolean): void {
  const from = join(root, name);
  const to = join(target, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`missing ${name}/ next to main.ts`);
    mkdirSync(to, { recursive: true });
    return;
  }
  cpSync(from, to, { recursive: true });
}

mkdirSync(target, { recursive: true });
bring('game', true);
bring('screenshots', false);
writeFileSync(join(target, 'dossier.json'), buildDossier(target, limits));
console.log(`entry written to ${target}`);
