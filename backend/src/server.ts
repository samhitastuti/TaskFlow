import { buildApp } from './app';
import dotenv from 'dotenv';

dotenv.config();

const start = async () => {
  try {
    const app = await buildApp();
    const port = Number(process.env.PORT) || 4000;
    
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening at http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
