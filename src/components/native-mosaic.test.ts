import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { objects } from '../lib/collection';
import { NativeMosaic } from './native-mosaic';

test('the native collection keeps all product controls without transformed tiles or startup image requests',()=>{
  const html=renderToStaticMarkup(createElement(NativeMosaic,{
    objects,filterKey:'alles',focused:false,saved:[objects[0].id],onToggle:()=>{},onOpen:()=>{},
  }));
  assert.match(html,/class="mosaic-native"/);
  assert.equal((html.match(/data-object="/g)||[]).length,objects.length);
  assert.equal((html.match(/data-present="true"/g)||[]).length,objects.length);
  assert.deepEqual(new Set([...html.matchAll(/data-column="(\d+)"/g)].map(match=>match[1])),new Set(['0','1','2']));
  assert.match(html,/data-row="64"/);
  assert.doesNotMatch(html,/transform:|will-change:|<img\b|<canvas\b/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/195 objecten in de collectie/);
});
