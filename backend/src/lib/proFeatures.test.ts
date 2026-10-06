import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';
import { PRO_FEATURES, hasProFeature, teamHasPro } from './proFeatures';

assert.deepEqual([...PRO_FEATURES], ['advancedAnalytics', 'rotations', 'momentum', 'heatmapsFull', 'multiSeasonFilters', 'printPdf', 'aiSummary']);
for (const f of PRO_FEATURES) {
  for (const team of [{ id: 't1' }, 't1', undefined, null]) {
    assert.equal(hasProFeature(team, f), true, `${f} is on for ${JSON.stringify(team)}`);
  }
}
assert.equal(teamHasPro(), true);

// The frontend keeps a copy (it has no test runner): from PRO_FEATURES to the
// end it must stay identical to this tested file.
const logic = (file: string) => {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return src.slice(src.indexOf('export const PRO_FEATURES'));
};
assert.equal(
  logic(path.join(__dirname, '../../../frontend/src/lib/proFeatures.ts')),
  logic(path.join(__dirname, 'proFeatures.ts')),
  'frontend/src/lib/proFeatures.ts has drifted from the tested backend copy',
);

console.log('proFeatures.test.ts passed');
