import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID in server/.env.');
const auth = getAuth(initializeApp({ projectId }));
// Signature, expiry, issuer and audience are checked using Google's public keys.
// This does not require a service-account private key; revocation checks are not enabled.
export async function verifyRequest(req) {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!match || match[1].length > 16000) throw new Error('Sign in required');
  const identity = await auth.verifyIdToken(match[1]);
  if (identity.firebase?.sign_in_provider === 'anonymous') throw new Error('Real account required');
  return identity;
}
