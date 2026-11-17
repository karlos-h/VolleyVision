// 9.6.S3: when may a Google sign-in be attached to an EXISTING account that has
// the same email, without the person proving they own that account? Pure.
//
// Only when nobody else could have produced this token for this address:
//   * Google says the address is verified, and
//   * we verified it ourselves when the account was made, and
//   * Google is the authority for the address: it is a gmail.com mailbox, or a
//     Google Workspace domain (the token carries `hd`).
// A Google account can be created on top of any address (a school or Outlook
// one), so for those Google saying "verified" is not proof the mailbox owner is
// the person signing in. Then the answer is LINK_REQUIRED: sign in with the
// password, connect Google from Profile.
import type { ProviderIdentity } from './providerToken';

export function googleIsAuthoritative(identity: Pick<ProviderIdentity, 'email' | 'hostedDomain'>): boolean {
  if (!identity.email) return false;
  return identity.email.toLowerCase().endsWith('@gmail.com') || !!identity.hostedDomain;
}

export function canAutoLink(
  identity: Pick<ProviderIdentity, 'email' | 'emailVerified' | 'hostedDomain'>,
  account: { emailVerifiedAt: Date | null },
): boolean {
  return identity.emailVerified && account.emailVerifiedAt != null && googleIsAuthoritative(identity);
}
