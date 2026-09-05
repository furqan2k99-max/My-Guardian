import { randomInt } from 'node:crypto';

// 6-char codes with lookalikes removed (0/O, 1/I) so they survive being
// read aloud or typed by a non-technical user.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}