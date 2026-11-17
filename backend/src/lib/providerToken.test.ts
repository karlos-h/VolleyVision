// 9.6.S2: Google ID tokens, checked against a locally generated key set (no network).
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { coerceEmailVerified, verifyGoogleIdToken } from './providerToken';

const AUD = 'web-client-id.apps.googleusercontent.com';
const NONCE = 'the-nonce-we-issued';
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function main() {
  const good = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });

  type MintOpts = { key?: typeof good.privateKey; exp?: string | number; iss?: string; aud?: string | null; sub?: string | null };
  const mint = (over: JWTPayload = {}, o: MintOpts = {}) => {
    let t = new SignJWT({ nonce: NONCE, email: 'Ana@Gmail.com', email_verified: true, given_name: 'Ana', family_name: 'Tui', ...over })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? 'https://accounts.google.com')
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '5m');
    if (o.aud !== null) t = t.setAudience(o.aud ?? AUD);
    if (o.sub !== null) t = t.setSubject(o.sub ?? 'google-sub-1');
    return t.sign(o.key ?? good.privateKey);
  };
  const check = (token: unknown, over: Partial<Parameters<typeof verifyGoogleIdToken>[1]> = {}) =>
    verifyGoogleIdToken(token, { keys, audiences: [AUD], expectedNonce: NONCE, ...over });
  const reason = async (p: ReturnType<typeof check>) => {
    const r = await p;
    assert.equal(r.ok, false);
    return r.ok ? '' : r.reason;
  };

  // Happy path: sub is the identity, email is lower-cased, names carried.
  const ok = await check(await mint());
  assert.ok(ok.ok);
  assert.deepEqual(ok.identity, { provider: 'GOOGLE', subject: 'google-sub-1', email: 'ana@gmail.com', emailVerified: true, givenName: 'Ana', familyName: 'Tui', hostedDomain: null });
  // Both issuer spellings; a Workspace token carries hd.
  const hd = await check(await mint({ hd: 'school.nz' }, { iss: 'accounts.google.com' }));
  assert.ok(hd.ok && hd.identity.hostedDomain === 'school.nz');
  // A second configured client id (iOS) is accepted for its own tokens.
  assert.equal((await check(await mint({}, { aud: 'ios-id' }), { audiences: [AUD, 'ios-id'] })).ok, true);

  // Wrong audience (a token minted for another app), wrong issuer, expired.
  assert.equal(await reason(check(await mint({}, { aud: 'another-app' }))), 'invalid');
  assert.equal(await reason(check(await mint({}, { aud: null }))), 'invalid');
  assert.equal(await reason(check(await mint({}, { iss: 'https://evil.example' }))), 'invalid');
  assert.equal(await reason(check(await mint({}, { exp: nowSeconds() - 3600 }))), 'expired');
  // 60 s of clock drift is tolerated, more is not.
  assert.equal((await check(await mint({}, { exp: nowSeconds() - 30 }))).ok, true);
  assert.equal(await reason(check(await mint({}, { exp: nowSeconds() - 90 }))), 'expired');
  // Signed by a key Google never published; unsigned; garbage; nothing.
  assert.equal(await reason(check(await mint({}, { key: other.privateKey }))), 'invalid');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'none' })}.${b64({ iss: 'https://accounts.google.com', aud: AUD, sub: 's', nonce: NONCE, exp: 9999999999 })}.`;
  assert.equal(await reason(check(unsigned)), 'invalid');
  assert.equal(await reason(check('not-a-jwt')), 'invalid');
  for (const bad of [undefined, null, '', 7]) assert.equal(await reason(check(bad)), 'missing');

  // Nonce: mismatched, absent from the token, or none expected.
  assert.equal(await reason(check(await mint({ nonce: 'another-session' }))), 'bad-nonce');
  assert.equal(await reason(check(await mint({ nonce: undefined }))), 'bad-nonce');
  assert.equal(await reason(check(await mint(), { expectedNonce: '' })), 'missing-nonce');
  // No subject: no identity.
  assert.equal(await reason(check(await mint({}, { sub: null }))), 'invalid');
  // No client id configured must refuse, not skip the audience check.
  assert.equal(await reason(check(await mint(), { audiences: [] })), 'not-configured');
  assert.equal(await reason(check(await mint(), { audiences: [''] })), 'not-configured');

  // email_verified: true or the string "true" (Apple); anything else is unverified.
  const cases: [unknown, boolean][] = [[true, true], ['true', true], [false, false], ['false', false], ['TRUE', false], [1, false], [undefined, false]];
  for (const [v, want] of cases) {
    assert.equal(coerceEmailVerified(v), want);
    const r = await check(await mint({ email_verified: v as never }));
    assert.ok(r.ok && r.identity.emailVerified === want);
  }
  // No email at all is still an identity (sub), with a null email.
  const noEmail = await check(await mint({ email: undefined }));
  assert.ok(noEmail.ok && noEmail.identity.email === null);

  console.log('providerToken.test.ts passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
