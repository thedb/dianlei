/**
 * Rewrite tools/pixel-editor/fixtures/sample.entity.json from sampleAssemblyEntity.
 * Run from the repo root: npx vite-node tools/pixel-editor/scripts/build-entity-fixture.ts
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { sampleAssemblyEntity, serializeEntityFile } from '@/game/art/entityFile';

const path = resolve('tools/pixel-editor/fixtures/sample.entity.json');
writeFileSync(path, serializeEntityFile(sampleAssemblyEntity()));
