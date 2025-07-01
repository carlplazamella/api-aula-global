// utils/djangoAuth.js
const crypto = require('crypto');

function verifyDjangoPassword(password, djangoHash) {
  const [algorithm, iterationsStr, salt, hash] = djangoHash.split('$');
  if (algorithm !== 'pbkdf2_sha256') {
    throw new Error(`Algoritmo no soportado: ${algorithm}`);
  }
  const iterations = Number(iterationsStr);
  const derivedKey = crypto.pbkdf2Sync(
    password, salt, iterations, 32, 'sha256'
  ).toString('base64');
  return crypto.timingSafeEqual(
    Buffer.from(derivedKey), Buffer.from(hash)
  );
}

function hashDjangoPassword(password, iterations = 260000) {
  const salt = crypto.randomBytes(12).toString('base64');
  const derivedKey = crypto.pbkdf2Sync(
    password, salt, iterations, 32, 'sha256'
  ).toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${derivedKey}`;
}

module.exports = { verifyDjangoPassword, hashDjangoPassword };
