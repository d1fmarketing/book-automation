module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'agents/**/*.js',
    'scripts/**/*.js',
    'qa/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/tests/**',
    '!**/*.test.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/test/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/.claude/'
  ],
  moduleFileExtensions: ['js', 'json'],
  testTimeout: 30000, // 30 seconds for agent tests
  verbose: true,
  testResultsProcessor: 'jest-junit',
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  // Mock Claude CLI and external APIs
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};