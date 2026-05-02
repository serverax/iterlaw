const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'lib/gov-apis/**/*.{ts,tsx}',
    '!lib/gov-apis/**/*.test.ts',
    '!lib/gov-apis/types.ts',
    'lib/validation/**/*.{ts,tsx}',
    '!lib/validation/**/*.test.ts',
    '!lib/validation/index.ts',
  ],
};

module.exports = createJestConfig(customJestConfig);
