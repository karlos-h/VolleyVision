// 9.6.R3: Netlify signs every request it proxies to Fly (x-nf-sign); anything
// that fails this check came straight to *.fly.dev and is refused.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { verifyProxySignature } from './proxySignature';

const SECRET = 'proxy-test-secret';
const NOW = 1_800_000_000_000; // ms
const nowS = NOW / 1000;
const claims = { deploy_context: 'production', iss: 'netlify', netlify_id: 'x', site_url: 'https://vv.test', exp: nowS + 60 };
const sign = (payload: object, secret = SECRET, opts: jwt.SignOptions = {}) => jwt.sign(payload, secret, { algorithm: 'HS256', ...opts });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

const good = verifyProxySignature(sign(claims), SECRET, NOW);
assert.equal(good.ok, true, 'a token signed like Netlify signs one passes');
if (good.ok) assert.equal(good.claims.site_url, 'https://vv.test');

const reject = (header: string | string[] | undefined, why: string, secret = SECRET) =>
  assert.equal(verifyProxySignature(header, secret, NOW).ok, false, why);

reject(undefined, 'missing header');
reject('', 'empty header');
reject([sign(claims), sign(claims)], 'header sent twice');
reject('not.a.jwt', 'garbage');
reject(sign(claims, 'other-secret'), 'signed with another secret');
reject(sign(claims), 'empty secret never verifies anything', '');
reject(sign({ ...claims, iss: 'someone' }), 'wrong issuer');
reject(sign({ deploy_context: 'production', site_url: 'x', exp: nowS + 60 }), 'no issuer');
reject(sign({ ...claims, exp: nowS - 61 }), 'expired beyond the 60 s tolerance');
const { exp: _exp, ...noExp } = claims;
reject(sign(noExp), 'no exp: would otherwise be valid forever');
assert.equal(verifyProxySignature(sign({ ...claims, exp: nowS - 30 }), SECRET, NOW).ok, true, 'inside the clock tolerance');

// alg: none, unsigned.
reject(`${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`, 'alg none');
// An RS256-shaped header with a valid HMAC over it: only HS256 is accepted, so
// an attacker can't steer the verifier into another algorithm family.
const rsInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}`;
reject(`${rsInput}.${createHmac('sha256', SECRET).update(rsInput).digest('base64url')}`, 'RS256 header');
reject(sign(claims, SECRET, { algorithm: 'HS512' }), 'HS512');

const expired = verifyProxySignature(sign({ ...claims, exp: nowS - 120 }), SECRET, NOW);
assert.equal(!expired.ok && expired.reason, 'expired');

console.log('proxySignature.test.ts passed');
