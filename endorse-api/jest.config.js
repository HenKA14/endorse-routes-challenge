/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  setupFiles: ['reflect-metadata'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/database/migrations/**', '!src/database/migrate.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
};
