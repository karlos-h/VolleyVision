// 9.6.R3: which address a per-IP rate limit keys on. On Fly the request may
// have come straight to *.fly.dev, so a header is only believed when Netlify's
// signature proved the request came through Netlify.
import assert from 'node:assert/strict';
import { pickClientIp } from './clientIp';

const NF = { 'x-nf-client-connection-ip': ' 203.0.113.9 ', 'x-forwarded-for': '198.51.100.1, 192.0.2.7' };

// Netlify Function and local dev: today's chain, unchanged.
assert.equal(pickClientIp({ headers: NF, proxyVerified: false, onFly: false, socketIp: '10.0.0.1' }), '203.0.113.9');
assert.equal(pickClientIp({ headers: { 'x-forwarded-for': '198.51.100.1, 192.0.2.7 ' }, proxyVerified: false, onFly: false, socketIp: '10.0.0.1' }), '192.0.2.7', 'right-most hop');
assert.equal(pickClientIp({ headers: {}, proxyVerified: false, onFly: false, socketIp: '10.0.0.1' }), '10.0.0.1');
assert.equal(pickClientIp({ headers: {}, proxyVerified: false, onFly: false }), 'unknown');

// On Fly, through Netlify's signed proxy: the client address Netlify reports.
assert.equal(pickClientIp({ headers: NF, proxyVerified: true, onFly: true, socketIp: '10.0.0.1' }), '203.0.113.9');
// No Netlify client header: the right-most x-forwarded-for hop is Netlify's
// own edge, so it isn't a client address; everyone shares one bucket instead.
assert.equal(pickClientIp({ headers: { 'x-forwarded-for': '198.51.100.1, 192.0.2.7' }, proxyVerified: true, onFly: true, socketIp: '10.0.0.1' }), 'unknown');

// On Fly, unsigned (straight to *.fly.dev): a spoofed header is ignored.
assert.equal(pickClientIp({ headers: NF, proxyVerified: false, onFly: true, socketIp: '10.0.0.1' }), '10.0.0.1', 'spoofed x-nf-client-connection-ip ignored');
assert.equal(pickClientIp({ headers: NF, proxyVerified: false, onFly: true }), 'unknown');

console.log('clientIp.test.ts passed');

// Verified but Netlify sent no client address: the edge hop, never one shared bucket.
assert.equal(pickClientIp({ headers: { 'fly-client-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.9' }, proxyVerified: true, onFly: true, socketIp: '10.0.0.1' }), '198.51.100.7');
assert.equal(pickClientIp({ headers: {}, proxyVerified: true, onFly: true, socketIp: '10.0.0.1' }), 'unknown');
console.log('clientIp.test.ts: fallback cases passed');
