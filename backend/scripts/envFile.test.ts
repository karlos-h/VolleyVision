// Pure-logic checks for envFile.ts. npx ts-node --transpile-only scripts/envFile.test.ts
import assert from 'node:assert/strict';
import { applyEnvFile, parseEnvFile } from './envFile';

const text = '# comment\r\nA="x y"\r\nB=\'q\'\r\n  export C = plain \r\nD=\r\nE=a=b#c\r\nnot a line\r\n';
assert.deepEqual(parseEnvFile(text), { A: 'x y', B: 'q', C: 'plain', D: '', E: 'a=b#c' });
assert.deepEqual(parseEnvFile('# A=1\n'), {});

const env: Record<string, string | undefined> = { KEEP: 'mine' };
applyEnvFile('U=1\nK=2\nKEEP=file', { NEW_U: 'U', NEW_K: 'K', KEEP: 'KEEP', MISSING: 'NOPE' }, env);
assert.deepEqual(env, { KEEP: 'mine', NEW_U: '1', NEW_K: '2' }, 'sets only unset targets, from the mapped keys');
console.log('envFile.test.ts passed.');
