// Import recommended base rules and the UNIFIED stylistic plugin
const eslintJs = require('@eslint/js')
const stylistic = require('@stylistic/eslint-plugin')

module.exports = [
    // 1. Base ESLint Recommended Rules
    eslintJs.configs.recommended,

    // 2. Configuration for all your JS files (includes Node, Styling, and Language options)
    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],

        plugins: {
            '@stylistic': stylistic
        },
        languageOptions: {
            // Explicitly enable Node.js and Console globals
            globals: {
                Buffer: 'readonly',
                console: 'readonly',
                require: 'readonly',
                module: 'readonly',
                setTimeout: 'readonly',
                URL: 'readonly',
                exports: 'writable', // exports is often written to
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly'
            },
            sourceType: 'module',
            ecmaVersion: 2022
        },
        rules: {
            // --- Formatting Rules ---
            '@stylistic/semi': ['error', 'never'],
            // FIXED: Changed 'true' to 'always' for allowTemplateLiterals
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],

            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
            '@stylistic/eol-last': ['error', 'always'],
            // '@stylistic/linebreak-style': ['error', 'unix'],
            '@stylistic/no-multi-spaces': ['error'],

            // --- Your Original Custom/Disabled Rules ---
            'no-unused-vars': [0],
            'eqeqeq': [0],
            'handle-callback-err': [0],
            'new-cap': [0],
            'no-new': [0]
        },
    },

    // 3. Global Ignores
    {
        ignores: [
            'node_modules/',
            'config/',
            'data/',
            'temp/*',
            'dist/',
            'build/',
            'public/',
            'tests/',
            'coverage/',
            '.vscode/',
            '.git/',
            '*.min.js',
            '*.md',
            '*.log',
            'package-lock.json',
            'package.json'
        ]
    }
]
