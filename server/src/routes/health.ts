import { Elysia } from 'elysia';
import { jsonBody } from '../lib/json';

export const healthRoutes = new Elysia()
  .get('/health', () =>
    jsonBody({
      status: 'ok',
      service: 'psusccshop-api',
      timestamp: new Date().toISOString(),
    }),
  );
