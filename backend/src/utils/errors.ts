import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode || 500;
  
  if (error instanceof ZodError) {
    return reply.status(422).send({
      type: 'https://taskflow.com/probs/validation-error',
      title: 'Validation Failed',
      status: 422,
      detail: 'One or more fields failed validation',
      errors: error.flatten().fieldErrors,
      instance: request.url
    });
  }

  if (statusCode === 401) {
    return reply.status(401).send({
      type: 'https://taskflow.com/probs/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: error.message,
      instance: request.url
    });
  }

  request.log.error(error);

  reply.status(statusCode).send({
    type: 'https://taskflow.com/probs/internal-server-error',
    title: error.name || 'Internal Server Error',
    status: statusCode,
    detail: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    instance: request.url
  });
}
