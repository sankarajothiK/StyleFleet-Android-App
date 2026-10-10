module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    // Tests never talk to the live Supabase project (they used to, and left test salons in it).
    // Only the opt-in live audit (RUN_LIVE_QA=1) uses the real client.
    ...(process.env.RUN_LIVE_QA === '1'
      ? {}
      : { '^(\\.\\./)+(src/)?lib/supabase$': '<rootDir>/__mocks__/supabase.js' }),
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    '^expo-font$': '<rootDir>/__mocks__/expo-font.js',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^expo-file-system(.*)$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-contacts(.*)$': '<rootDir>/__mocks__/expo-contacts.js',
    '^react-native-svg$': '<rootDir>/__mocks__/react-native-svg.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '\\.(ttf|otf|eot|woff|woff2|png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  testTimeout: 20000,
};
