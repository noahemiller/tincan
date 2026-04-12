import { FastifyReply, FastifyRequest } from 'fastify';

import { verifyAccessToken } from './jwt.js';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing bearer token' });
  }

  try {
    const token = header.slice('Bearer '.length);
    request.authUser = verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}
