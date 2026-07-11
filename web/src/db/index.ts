import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure neonConfig.fetchFunction to retry on transient connection failures/timeouts (e.g. database cold start)
if (typeof window === 'undefined') {
  const originalFetch = globalThis.fetch;

  neonConfig.fetchFunction = async (input, init) => {
    let retries = 3;
    let delay = 1000;

    while (true) {
      try {
        return await originalFetch(input, init);
      } catch (error: any) {
        const isTransient =
          error instanceof TypeError ||
          error.message?.includes('fetch failed') ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET' ||
          error.name === 'ConnectTimeoutError';

        if (isTransient && retries > 0) {
          retries--;
          console.warn(
            `Neon database query failed (remaining retries: ${retries}, delay: ${delay}ms). Error: ${error.message || error}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw error;
        }
      }
    }
  };
}

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });

