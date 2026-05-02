/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
