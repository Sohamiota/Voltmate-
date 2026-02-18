const bcrypt = require('bcryptjs');
const pass = process.argv[2] || 'pass123';
bcrypt.hash(pass, 10, (err, hash) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(hash);
});

