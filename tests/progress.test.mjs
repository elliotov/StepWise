import test from 'node:test';import assert from 'node:assert/strict';import {loadingProgress} from '../progress.js';
test('generation shows activity without a fabricated percent',()=>{const html=loadingProgress({label:'Creating steps…',steps:3});assert.match(html,/<progress/);assert.match(html,/3 steps drafted/);assert.doesNotMatch(html,/value=/);});
test('download uses actual percentage and clamps values',()=>{assert.match(loadingProgress({download:41}),/value="41"/);assert.match(loadingProgress({download:200}),/value="100"/);});
test('loading label escapes markup',()=>{assert.doesNotMatch(loadingProgress({label:'<script>x</script>'}),/<script>/);});
