// scratch/test-pg.ts
import { parse } from 'pg-connection-string';
import dotenv from 'dotenv';

dotenv.config();

const config = parse(process.env.DATABASE_URL!);
console.log('Password in config:', config.password);
console.log('Decoded password in config:', config.password ? decodeURIComponent(config.password) : null);
