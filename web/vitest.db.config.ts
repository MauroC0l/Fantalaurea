import { defineConfig } from 'vitest/config';

// Runs against the local Supabase stack (npm run db:start) and wipes its evening data.
export default defineConfig({
  test: {
    include: ['src/**/*.db-test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
