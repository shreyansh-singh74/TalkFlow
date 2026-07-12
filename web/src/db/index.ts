import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure neonConfig.fetchFunction to retry on transient connection failures/timeouts (e.g. database cold start)
if (typeof window === 'undefined') {
  const originalFetch = globalThis.fetch;

  neonConfig.fetchFunction = async (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
  ) => {
    let retries = 3;
    let delay = 1000;

    while (true) {
      try {
        return await originalFetch(input, init);
      } catch (error) {
        const isTransient =
          error instanceof TypeError ||
          (error instanceof Error && error.message?.includes('fetch failed')) ||
          (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ETIMEDOUT') ||
          (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ECONNRESET') ||
          (error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'ConnectTimeoutError');

        if (isTransient && retries > 0) {
          retries--;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(
            `Neon database query failed (remaining retries: ${retries}, delay: ${delay}ms). Error: ${errorMessage}`
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

