import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';

test('the homepage starts without a product dialog before a visitor selects an object', async () => {
  const require = createRequire(import.meta.url), previousCss = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { Lothuus } = await import('./lothuus');
    const html = renderToStaticMarkup(<Lothuus />);
    assert.match(html, /id="collectie"/);
    assert.doesNotMatch(html, /<dialog\b/);
    assert.doesNotMatch(html, /class="detail-content"/);
  } finally {
    if (previousCss) require.extensions['.css'] = previousCss; else delete require.extensions['.css'];
  }
});
