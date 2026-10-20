import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
export default tseslint.config({ ignores: ['dist', '*.tsbuildinfo'] }, js.configs.recommended, {files:['host-public/classifieds/*.js','tests/host-classifieds-sdk.mjs'],languageOptions:{globals:globals.browser},rules:{'no-unused-vars':'off','no-empty':'off','no-useless-escape':'off'}}, ...tseslint.configs.recommended, { files: ['**/*.{ts,tsx}'], languageOptions: { globals: globals.browser }, plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } });
