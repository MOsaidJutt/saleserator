module.exports = [
  {
    files: ['*.js', '*.jsx'], // Apply to JavaScript and JSX files
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020, // Enable ECMAScript 2020 features
        sourceType: 'module', // Use module syntax (import/export)
      },
      globals: {
        // Add global variables here if needed
      },
    },
    plugins: {
      prettier: require('eslint-plugin-prettier'), // Define Prettier plugin as an object
    },
    rules: {
      'no-console': 'warn', // Warn about console logs in production
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          semi: true,
        },
      ],
    },
  },
  require('eslint-config-prettier'), // Include Prettier configuration
];
