export const TOKEN_LENGTH = 32;

export function generateToken(): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let token = '';
  for (let i = 0, n = charset.length; i < TOKEN_LENGTH; ++i) {
    token += charset.charAt(Math.floor(Math.random() * n));
  }

  return token;
}
