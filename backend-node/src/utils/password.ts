import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const roundsRaw = process.env.BCRYPT_SALT_ROUNDS || '10';
  const rounds = parseInt(roundsRaw, 10);
  return bcrypt.hash(password, Number.isFinite(rounds) && rounds > 0 ? rounds : 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
