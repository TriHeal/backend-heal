const crypto = require('crypto');

const israeliId = '123456789'; // your test T.Z
const secret = 'YOUR_AUTH_ID_HASH_SECRET'; // same value as in server/.env

const normalizedId = israeliId.replace(/\D/g, '').padStart(9, '0');

const hash = crypto
  .createHmac('sha256', secret)
  .update(normalizedId)
  .digest('hex')
  .slice(0, 32);


console.log(`${hash}@auth.triheal.local`);