import assert from 'node:assert/strict';
import { transactionName, sentryRequestScope } from './sentryRequest';

assert.equal(transactionName('GET', '/api/v1/teams/cabcdefghijklmnopqrstuvwx/players?x=1'), 'GET /api/v1/teams/:id/players');
assert.equal(transactionName('POST', '/api/v1/invitations/sometoken/accept'), 'POST /api/v1/invitations/:token/accept');
assert.equal(transactionName('GET', '/api/v1/teams/cabcdefghijklmnopqrstuvwx'), 'GET /api/v1/teams/:id');

const seen: any = { tags: {} };
const fake: any = {
  getCurrentScope: () => ({ setTransactionName: (n: string) => { seen.name = n; } }),
  setTag: (k: string, v: string) => { seen.tags[k] = v; },
};
let nexted = false;
sentryRequestScope(fake)({ method: 'GET', originalUrl: '/api/v1/x?y=1', headers: { 'x-client': 'android/9.15.0' } } as any, {} as any, () => { nexted = true; });
assert.equal(seen.name, 'GET /api/v1/x');
assert.equal(seen.tags.client, 'android/9.15.0');
assert.ok(nexted);
console.log('sentryRequest.test.ts passed');
