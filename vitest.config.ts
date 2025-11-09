/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: ['@eventcatalog/sdk'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'examples/**', '**/*.config.*', '**/test/**', 'vitest.setup.ts'],
    },
  },
});
