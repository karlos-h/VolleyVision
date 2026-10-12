// Run on tag pushes (CI `version` job): fails when versionName in
// android/app/build.gradle is not the tag without its `v`. The release PR sets
// versionName, and v9.18.1 was tagged with 9.18.0 still in it.
//   node scripts/check-version.mjs [tag]     (default: $GITHUB_REF_NAME)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const versionNameOf = (gradle) => gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? null;

// Returns a problem string, or null when the tag and versionName agree.
export function checkVersion(gradle, tag) {
  if (!tag) return 'no tag given: pass one or set GITHUB_REF_NAME';
  const name = versionNameOf(gradle);
  if (!name) return 'no versionName found in android/app/build.gradle';
  const want = tag.replace(/^v/, '');
  return name === want ? null : `versionName is ${name} but the tag is ${tag}: bump versionName in android/app/build.gradle to ${want} in the release PR`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problem = checkVersion(readFileSync('android/app/build.gradle', 'utf8'), process.argv[2] ?? process.env.GITHUB_REF_NAME);
  if (problem) { console.error(`check-version: ${problem}`); process.exit(1); }
  console.log('check-version: versionName matches the tag');
}
