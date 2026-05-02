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
  ],
};

module.exports = createJestConfig(customJestConfig);
