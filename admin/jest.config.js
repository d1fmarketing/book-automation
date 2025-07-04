module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  collectCoverageFrom: [
    'server.js',
    'scripts/**/*.js',
    '!**/node_modules/**',
    '!**/client/**'
  ],
  coverageDirectory: 'coverage',
  testTimeout: 30000
};