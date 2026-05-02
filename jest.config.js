const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './apps/web' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/apps/web/.next/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/apps/web/.next/standalone/'],
  collectCoverageFrom: [
    'apps/web/lib/gov-apis/**/*.{ts,tsx}',
    '!apps/web/lib/gov-apis/**/*.test.ts',
    '!apps/web/lib/gov-apis/types.ts',
    'apps/web/lib/validation/**/*.{ts,tsx}',
    '!apps/web/lib/validation/**/*.test.ts',
    '!apps/web/lib/validation/index.ts',
    'apps/web/lib/ai/**/*.ts',
    '!apps/web/lib/ai/**/*.test.ts',
    '!apps/web/lib/ai/index.ts',
    'apps/web/types/**/*.ts',
    'apps/web/lib/agents/**/*.ts',
    '!apps/web/lib/agents/**/*.test.ts',
    'apps/web/lib/workflow/**/*.ts',
    '!apps/web/lib/workflow/**/*.test.ts',
    'apps/web/lib/supabase/client.ts',
    '!apps/web/lib/supabase/**/*.test.ts',
    'apps/web/lib/prompts/**/*.ts',
    'apps/web/components/dashboard/**/*.{tsx,ts}',
    '!apps/web/components/dashboard/**/*.test.tsx',
    'apps/web/app/api/axiom/**/*.ts',
    'apps/web/lib/axiom/**/*.ts',
    '!apps/web/lib/axiom/**/*.test.ts',
    'apps/web/hooks/**/*.ts',
    '!apps/web/hooks/**/*.test.ts',
    'apps/web/lib/qa-pool/**/*.ts',
    '!apps/web/lib/qa-pool/**/*.test.ts',
    'apps/web/lib/answer/**/*.ts',
    '!apps/web/lib/answer/**/*.test.ts',
    'apps/web/lib/documents/**/*.ts',
    '!apps/web/lib/documents/**/*.test.ts',
    'apps/web/app/api/answer/**/*.ts',
    '!apps/web/app/api/answer/**/*.test.ts',
  ],
};

module.exports = createJestConfig(customJestConfig);
