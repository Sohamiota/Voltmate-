/* One-shot: prints bcrypt hash (cost 12) for argv[2]. Usage: node scripts/gen-hash-once.js 'YourPassword' */
const bcrypt = require('bcryptjs');
const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/gen-hash-once.js <password>');
  process.exit(1);
}
bcrypt.hash(pw, 12).then((h) => {
  console.log('length', h.length);
  console.log(h);
});
