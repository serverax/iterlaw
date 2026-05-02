const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'lib/gov-apis/**/*.{ts,tsx}',
    '!lib/gov-apis/**/*.test.ts',
    '!lib/gov-apis/types.ts',
    'lib/validation/**/*.{ts,tsx}',
    '!lib/validation/**/*.test.ts',
    '!lib/validation/index.ts',
    'lib/ai/**/*.ts',
    '!lib/ai/**/*.test.ts',
    '!lib/ai/index.ts',
    'types/**/*.ts',
    'lib/agents/**/*.ts',
    '!lib/agents/**/*.test.ts',
    'lib/workflow/**/*.ts',
    '!lib/workflow/**/*.test.ts',
    'lib/supabase/client.ts',
    '!lib/supabase/**/*.test.ts',
    'lib/prompts/**/*.ts',
    'components/dashboard/**/*.{tsx,ts}',
    '!components/dashboard/**/*.test.tsx',
    'app/api/axiom/**/*.ts',
    'lib/axiom/**/*.ts',
    '!lib/axiom/**/*.test.ts',
    'hooks/**/*.ts',
    '!hooks/**/*.test.ts',
    'lib/qa-pool/**/*.ts',
    '!lib/qa-pool/**/*.test.ts',
    'lib/answer/**/*.ts',
    '!lib/answer/**/*.test.ts',
    'lib/documents/**/*.ts',
    '!lib/documents/**/*.test.ts',
    'app/api/answer/**/*.ts',
    '!app/api/answer/**/*.test.ts',
  ],
};

module.exports = createJestConfig(customJestConfig);
