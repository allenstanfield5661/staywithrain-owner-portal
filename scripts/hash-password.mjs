import { hashSync } from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  console.error("Use at least 10 characters. Paste the printed hash into ADMIN_PASSWORD_HASH.");
  process.exit(1);
}

process.stdout.write(`${hashSync(password, 12)}\n`);
