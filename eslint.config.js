const standardConfig = require('eslint-config-standard');

module.exports = {
    // ...standardConfig,

    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020, // or any other version you want to support
            // sourceType: 'module', // if you're using ES modules
            // Add other parser options here if needed
        }
    },
    rules: {
        'no-multi-spaces': ['error'], // Disallow multiple spaces
        eqeqeq: [0],
        'handle-callback-err': [0],
        'no-unused-vars': [0],
        indent: [1, 4],
        'new-cap': [0],
        'no-new': [0]
    },
    ignores: [
        'node_modules/',
        'config/',
        'dist/',
        'build/',
        'public/',
        'tests/',
        '*.min.js',
        'temp/*',
        '*.md',
        'package-lock.json',
        'package.json'
    ],
};
