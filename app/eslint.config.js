import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // shadcn primitives + the auth provider colocate helpers/hooks with a component (intentional)
  {
    files: ['src/components/ui/**', 'src/auth.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // debounced typeahead intentionally syncs state from within its effect
  {
    files: ['src/components/LocationInput.jsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
])
