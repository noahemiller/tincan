import jwt from 'jsonwebtoken';

import { config } from '../config.js';

export type AuthTokenPayload = {
  userId: string;
  email: string;
};

export function signAccessToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
}
