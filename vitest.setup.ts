import { expect } from 'vitest';

interface CustomMatchers<R = unknown> {
  toMatchMarkdown: (str: string) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// Function to normalize whitespace
const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace vitest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Assertion<T> {
      toMatchMarkdown(expected: string): void;
    }
  }
}

// Custom matcher to compare Markdown strings ignoring whitespace differences
expect.extend({
  toMatchMarkdown(received, expected) {
    const normalizedReceived = normalizeWhitespace(received);
    const normalizedExpected = normalizeWhitespace(expected);

    if (normalizedReceived === normalizedExpected) {
      return {
        message: () => `expected ${received} not to match Markdown ${expected} ignoring whitespace`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to match Markdown ${expected} ignoring whitespace`,
        pass: false,
      };
    }
  },
});
