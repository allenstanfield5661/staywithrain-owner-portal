import bcrypt from "bcryptjs";

function rounds(): number {
  return process.env.VITEST ? 4 : 12;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds());
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
