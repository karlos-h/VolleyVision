import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scrubUrl, scrubTransaction } from './scrubUrl';

// Record ids (cuids) are not credentials and stay: they make an error findable.
const CUID = 'ckz8x1q0v0000abcd1234efgh';
assert.equal(scrubUrl(`/api/v1/teams/${CUID}/members`), `/api/v1/teams/${CUID}/members`);

// A team join code in the lookup path.
assert.equal(scrubUrl('/api/v1/invitations/lookup/K7Q2M9PX'), '/api/v1/invitations/lookup/:code');
assert.equal(scrubUrl('https://volleyvision-app.netlify.app/api/v1/invitations/lookup/AB%2DCD?x=1'), 'https://volleyvision-app.netlify.app/api/v1/invitations/lookup/:code');

// An invitation token (UUID) on accept/decline.
const TOKEN = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
assert.equal(scrubUrl(`/api/v1/invitations/${TOKEN}/accept`), '/api/v1/invitations/:token/accept');
assert.equal(scrubUrl(`/api/v1/invitations/${TOKEN}/decline#top`), '/api/v1/invitations/:token/decline');

// Routes with fixed segments are left alone.
assert.equal(scrubUrl('/api/v1/invitations/redeem'), '/api/v1/invitations/redeem');
assert.equal(scrubUrl('/api/v1/invitations/redeem-team-code'), '/api/v1/invitations/redeem-team-code');

// Query strings and fragments always go.
assert.equal(scrubUrl('/reset-password?token=secret'), '/reset-password');
assert.equal(scrubUrl('/a#b'), '/a');

// Tracing: fetch spans carry the same join codes and invitation tokens.
const event = {
  transaction: 'GET /invitations/lookup/ABC123?x=1',
  request: { url: 'https://x.test/api/v1/invitations/lookup/ABC123?code=ABC123', query_string: 'code=ABC123' },
  spans: [
    { description: 'GET /api/v1/invitations/lookup/ABC123', data: undefined as Record<string, unknown> | undefined },
    {
      description: 'POST /api/v1/invitations/tok_secret/accept',
      data: {
        url: 'https://x.test/api/v1/invitations/tok_secret/accept?code=ABC123',
        'http.url': 'https://x.test/api/v1/invitations/lookup/ABC123',
        'url.full': 'https://x.test/api/v1/invitations/tok_secret/accept#ABC123',
        'http.query': 'code=ABC123',
        'http.fragment': 'frag',
        'http.method': 'POST',
      } as Record<string, unknown>,
    },
    { description: 'GET /api/v1/teams/abc/members', data: {} },
  ],
  contexts: { trace: { data: { 'url.full': 'https://x.test/invitations/tok_secret/accept?a=ABC123', 'http.query': 'ABC123' } } },
};
const scrubbed = scrubTransaction(event);
const json = JSON.stringify(scrubbed);
assert.ok(!json.includes('ABC123') && !json.includes('tok_secret'), `credential left in ${json}`);
assert.equal(scrubbed.transaction, 'GET /invitations/lookup/:code');
assert.equal(scrubbed.spans[2].description, 'GET /api/v1/teams/abc/members');
assert.equal(scrubbed.spans[1].data!['http.method'], 'POST');

// The frontend keeps a copy (no test runner): everything from CREDENTIAL_SEGMENTS
// down must stay byte-identical to this tested file.
const logic = (file: string) => {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return src.slice(src.indexOf('const CREDENTIAL_SEGMENTS'));
};
assert.equal(
  logic(path.join(__dirname, '../../../frontend/src/lib/scrubUrl.ts')),
  logic(path.join(__dirname, 'scrubUrl.ts')),
  'frontend/src/lib/scrubUrl.ts has drifted from the tested backend copy',
);

console.log('scrubUrl.test.ts passed');
