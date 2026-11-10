import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';
import { defineSecret, defineString } from 'firebase-functions/params';

/**
 * 6-digit email verification, replacing Firebase's "tap the link" email.
 *
 *   sendEmailCode   – makes a code, stores only its hash in emailCodes/{uid}, emails the plain code.
 *   verifyEmailCode – checks the code (max 5 tries, 10 minutes) and marks the email as verified.
 *
 * emailCodes is not readable by the app (firestore.rules closes everything else); only these functions
 * touch it through the Admin SDK.
 *
 * Email is sent with Resend (https://resend.com). One-time setup:
 *   firebase functions:secrets:set RESEND_API_KEY
 *   set EMAIL_FROM in functions/.env, e.g.  EMAIL_FROM=METAKNOWIA <no-reply@yourdomain.com>
 * Resend only delivers to other people once your sending domain is verified in its dashboard.
 */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const EMAIL_FROM = defineString('EMAIL_FROM', { default: 'METAKNOWIA <onboarding@resend.dev>' });

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_TRIES = 5;

const hash = (uid: string, code: string) => createHash('sha256').update(`${uid}:${code}`).digest('hex');

function requireUser(req: CallableRequest<unknown>) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please log in first.');
  return req.auth.uid;
}

async function sendMail(to: string, code: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM.value(),
      to,
      subject: `${code} is your METAKNOWIA code`,
      text: `Your METAKNOWIA verification code is ${code}.\n\nIt expires in 10 minutes. If you did not sign up, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">
        <h2 style="color:#1E3A8A">Verify your email</h2>
        <p>Enter this code in the METAKNOWIA app:</p>
        <p style="font-size:36px;letter-spacing:10px;font-weight:700;color:#1D4ED8;margin:16px 0">${code}</p>
        <p style="color:#64748B">It expires in 10 minutes. If you did not sign up, you can ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) {
    console.error('Resend failed', res.status, await res.text());
    throw new HttpsError('internal', 'Could not send the email. Please try again later.');
  }
}

export const sendEmailCode = onCall({ secrets: [RESEND_API_KEY], timeoutSeconds: 30 }, async (req: CallableRequest<unknown>) => {
  const uid = requireUser(req);
  const user = await getAuth().getUser(uid);
  if (!user.email) throw new HttpsError('failed-precondition', 'This account has no email.');
  if (user.emailVerified) return { alreadyVerified: true };

  const ref = getFirestore().doc(`emailCodes/${uid}`);
  const snap = await ref.get();
  const last = snap.get('sentAt') as Timestamp | undefined;
  if (last && Date.now() - last.toMillis() < RESEND_AFTER_MS) {
    throw new HttpsError('resource-exhausted', 'Please wait a minute before asking for another code.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await ref.set({ hash: hash(uid, code), email: user.email, tries: 0, sentAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS) });
  await sendMail(user.email, code);
  return { sent: true };
});

export const verifyEmailCode = onCall({ timeoutSeconds: 30 }, async (req: CallableRequest<{ code?: string }>) => {
  const uid = requireUser(req);
  const code = String(req.data?.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'Type the 6-digit code.');

  const ref = getFirestore().doc(`emailCodes/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'No code yet. Tap “Send a new code”.');
  const d = snap.data() as { hash: string; email: string; tries: number; expiresAt: Timestamp };

  if (d.expiresAt.toMillis() < Date.now()) throw new HttpsError('deadline-exceeded', 'That code expired. Send a new one.');
  if (d.tries >= MAX_TRIES) throw new HttpsError('resource-exhausted', 'Too many wrong tries. Send a new code.');

  const ok = timingSafeEqual(Buffer.from(hash(uid, code)), Buffer.from(d.hash));
  if (!ok) {
    await ref.update({ tries: FieldValue.increment(1) });
    throw new HttpsError('permission-denied', 'Wrong code. Check it and try again.');
  }

  // The code only proves the address it was sent to; make sure it is still the account's address.
  const user = await getAuth().getUser(uid);
  if (user.email !== d.email) throw new HttpsError('failed-precondition', 'The email changed. Send a new code.');
  await getAuth().updateUser(uid, { emailVerified: true });
  await ref.delete();
  return { verified: true };
});
