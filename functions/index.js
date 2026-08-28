/* Code13 billing automation (2026-08-28, user: "can we not automize this").
 *
 * Replaces the manual launch flow (Stripe email -> Firebase console -> hand
 * -written users/{uid}/meta/plus doc) with a Stripe webhook. The GRANT SHAPE
 * IS UNCHANGED - the exact same meta/plus {active, tier} doc the console
 * flow wrote and the client's grantSync (entitlements.js) already reads, so
 * nothing client-side changes at all. Console grants keep working alongside
 * this (revocation only ever touches docs this function itself wrote).
 *
 * Flow:
 *  - checkout.session.completed  -> grant by the buyer's checkout email.
 *      Buyer has a Code13 account (same email): meta/plus written now.
 *      Buyer hasn't signed up yet: parked in pendingGrants/{email}, applied
 *      the moment that email creates an account (onUserCreated below) - this
 *      closes the "pay first, sign up after" gap the manual flow had.
 *  - customer.subscription.deleted -> revoke weekly/monthly when the sub
 *      actually ends (Stripe fires this at period end, not at cancel-click).
 *      Lifetime is a one-time payment, no subscription - never revoked.
 *
 * Tier comes from the session's payment_link id (amount_total can't be
 * trusted: a trial checkout completes at $0). New/changed Payment Links must
 * be added to PLINK_TIER or purchases through them fall back to 'lifetime'
 * only if amount matches - otherwise they're logged and skipped for a
 * manual grant.
 *
 * Secrets: STRIPE_WEBHOOK_SECRET (the webhook endpoint's signing secret,
 * whsec_...) - set with `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.
 * No Stripe API key needed: everything used here rides in on the event
 * payload itself.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Payment Link id -> tier. Ids read straight off the Stripe dashboard
// (2026-08-28); the pay links themselves live in entitlements.js PAY_LINKS.
const PLINK_TIER = {
  plink_1U8mQc3a4wjFAjPa2379ilNQ: 'weekly',
  plink_1U8mOl3a4wjFAjPaKCKd3WXN: 'monthly',
  plink_1U8mMy3a4wjFAjPa88QJypJr: 'lifetime',
};

// Last-resort tier mapping when a session arrives from an unknown link
// (e.g. a link recreated in the dashboard without updating PLINK_TIER).
// Amounts are cents. Trials complete at 0 and stay unmapped on purpose.
const AMOUNT_TIER = { 903: 'weekly', 3100: 'monthly', 13000: 'lifetime' };

async function grantByEmail(email, tier, context) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) {
    logger.error('grant skipped: no email on session', context);
    return;
  }
  let user = null;
  try {
    user = await admin.auth().getUserByEmail(clean);
  } catch (err) {
    // auth/user-not-found is the pay-first-sign-up-later case; anything
    // else is a real failure worth surfacing.
    if (err.code !== 'auth/user-not-found') throw err;
  }
  if (user) {
    await db.collection('users').doc(user.uid).collection('meta').doc('plus').set({
      active: true,
      tier,
      src: 'stripe',
      email: clean,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info(`granted ${tier} to ${clean} (uid ${user.uid})`, context);
  } else {
    await db.collection('pendingGrants').doc(clean).set({
      tier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info(`no account yet for ${clean} - parked in pendingGrants`, context);
  }
}

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_WEBHOOK_SECRET], region: 'us-central1', cors: false },
  async (req, res) => {
    let event;
    try {
      event = Stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.error('signature verification failed', { message: err.message });
      res.status(400).send('bad signature');
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_details && session.customer_details.email;
        const tier = PLINK_TIER[session.payment_link] || AMOUNT_TIER[session.amount_total] || null;
        if (!tier) {
          logger.error('unmapped checkout - grant manually', {
            paymentLink: session.payment_link,
            amount: session.amount_total,
            email,
          });
        } else {
          // Subscriptions carry a customer id - remember its email so the
          // end-of-subscription event (which only has the id) can find who
          // to revoke without a Stripe API call.
          if (session.customer) {
            await db.collection('stripeCustomers').doc(String(session.customer)).set({
              email: String(email || '').trim().toLowerCase(),
              tier,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          await grantByEmail(email, tier, { eventId: event.id });
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const mapSnap = await db.collection('stripeCustomers').doc(String(sub.customer)).get();
        const email = mapSnap.exists && mapSnap.data().email;
        if (!email) {
          logger.error('subscription ended for unknown customer - check manually', { customer: sub.customer });
        } else {
          let user = null;
          try { user = await admin.auth().getUserByEmail(email); } catch (err) { /* never signed up */ }
          if (user) {
            const plusRef = db.collection('users').doc(user.uid).collection('meta').doc('plus');
            const plusSnap = await plusRef.get();
            const plus = plusSnap.exists ? plusSnap.data() : null;
            // Only unwind grants this function itself wrote, and never a
            // lifetime - a hand-written console grant stays untouched.
            if (plus && plus.src === 'stripe' && plus.tier !== 'lifetime') {
              await plusRef.delete();
              logger.info(`revoked ${plus.tier} for ${email} (subscription ended)`);
            }
          }
          await db.collection('pendingGrants').doc(email).delete().catch(() => {});
        }
      }
      res.status(200).send('ok');
    } catch (err) {
      logger.error('webhook handling failed', { type: event.type, message: err.message });
      // 500 makes Stripe retry - grants must not be silently dropped.
      res.status(500).send('error');
    }
  }
);

// Pay-first, sign-up-after: the moment the buyer's email becomes a real
// account, any parked grant applies itself. (v1 trigger - v2 has no plain
// auth-created event without Identity Platform.)
exports.onUserCreated = functionsV1.auth.user().onCreate(async (user) => {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return;
  const pendingRef = db.collection('pendingGrants').doc(email);
  const snap = await pendingRef.get();
  if (!snap.exists) return;
  const { tier } = snap.data();
  await db.collection('users').doc(user.uid).collection('meta').doc('plus').set({
    active: true,
    tier,
    src: 'stripe',
    email,
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await pendingRef.delete();
  logger.info(`applied pending ${tier} grant to new account ${email}`);
});
