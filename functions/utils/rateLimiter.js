const admin = require('firebase-admin');

/**
 * Checks and updates rate limiting for a user using a sliding window.
 * @param {string} uid - User ID
 * @param {string} action - 'llm' or 'flight'
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowMs - Window duration in milliseconds (default 1 hour)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetTime: number }>}
 */
async function checkRateLimit(uid, action, limit, windowMs = 3600000) {
  const db = admin.firestore();
  const rateLimitRef = db.collection('rateLimits').doc(`${uid}_${action}`);
  const now = Date.now();

  let allowed = false;
  let remaining = 0;
  let resetTime = now + windowMs;

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitRef);
    let timestamps = [];

    if (doc.exists) {
      const data = doc.data();
      timestamps = data.timestamps || [];
    }

    // Filter out timestamps outside the sliding window
    const windowStart = now - windowMs;
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length < limit) {
      timestamps.push(now);
      allowed = true;
      remaining = limit - timestamps.length;
      transaction.set(rateLimitRef, { timestamps }, { merge: true });
    } else {
      allowed = false;
      remaining = 0;
      // Reset time is when the oldest timestamp falls outside the window
      resetTime = timestamps[0] + windowMs;
    }
  });

  return { allowed, remaining, resetTime };
}

module.exports = { checkRateLimit };
