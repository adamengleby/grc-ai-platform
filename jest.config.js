module.exports = {
  // Root configuration for the workspace
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Workspace configuration
  projects: [
    '<rootDir>/packages/*/jest.config.js'
  ],
  
  // Global test configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.{ts,tsx}',
    '!packages/*/src/**/*.spec.{ts,tsx}',
    '!packages/*/src/test/**/*',
    '!packages/*/src/**/__tests__/**/*',
    '!packages/*/dist/**/*',
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'cobertura'
  ],
  
  // Coverage thresholds for enterprise standards
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Stricter thresholds for security-critical packages
    './packages/backend/src/security/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './packages/mcp-server/src/privacy/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Test setup and configuration
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^@grc-ai-platform/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@/(.*)$': '<rootDir>/packages/$1/src'
  },
  
  // Test patterns
  testMatch: [
    '<rootDir>/packages/*/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/packages/*/src/**/*.{test,spec}.{ts,tsx}'
  ],
  
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/deprecated-files/',
    '/coverage/'
  ],
  
  // Transforms
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          moduleResolution: 'node',
          allowJs: true,
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true
        }
      }
    }]
  },
  
  // File extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Global variables for tests
  globals: {
    'ts-jest': {
      useESM: false,
      isolatedModules: true
    },
    // Test environment globals
    TEST_TENANT_ID: 'test-tenant-001',
    TEST_USER_ID: 'test-user-001',
    MOCK_AZURE_SERVICES: true,
    ENABLE_SECURITY_TESTS: true
  },
  
  // Reporters for CI/CD integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      uniqueOutputName: 'false',
      classNameTemplate: '{classname}-{title}',
      titleTemplate: '{classname}-{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: 'true'
    }],
    ['jest-html-reporters', {
      publicPath: 'test-results',
      filename: 'report.html',
      expand: true
    }]
  ],
  
  // Timeout configuration
  testTimeout: 30000,
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/test-results/'
  ],
  
  // Cache configuration
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: process.env.CI === 'true',
  
  // Fail fast on CI
  bail: process.env.CI === 'true' ? 1 : 0,
  
  // Maximum worker processes
  maxWorkers: process.env.CI === 'true' ? 2 : '50%',
  
  // Force exit after tests complete
  forceExit: process.env.CI === 'true',
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Detect leaks
  detectLeaks: false,
  
  // Silent mode for CI
  silent: process.env.CI === 'true' && process.env.JEST_VERBOSE !== 'true'
};