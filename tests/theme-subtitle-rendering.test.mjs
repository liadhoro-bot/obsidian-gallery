import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'

const result = buildSync({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { RecipeGuideThemeStepCard, RecipeGuideAltThemeStepCard } from './app/guides/shared/recipe-guide-cards';
    export function render(variant, subtitle) {
      return renderToStaticMarkup(createElement(variant === 'a' ? RecipeGuideThemeStepCard : RecipeGuideAltThemeStepCard, {
        step: { id: 'skin', step_number: 5, title: 'Skin', instructions: 'Thin coats', image_url: null, subtitle },
        paints: [], stepsLength: 8, showBrandMark: false,
      }));
    }
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external',
  loader: { '.css': 'empty', '.module.css': 'empty' }, write: false,
})
const compiled = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports)

for (const variant of ['a', 'b']) {
  test(`theme ${variant}: actual card hides cleared subtitles and retains numbered subtitles`, () => {
    for (const subtitle of ['', ' ', '\n']) {
      const html = compiled.exports.render(variant, subtitle)
      assert.doesNotMatch(html, /Color Reference|recipe-guide-alt-theme-kicker/)
    }
    assert.match(compiled.exports.render(variant, 'Step 5'), /Step 5/)
    assert.match(compiled.exports.render(variant, null), /Color Reference/)
  })
}
