import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCards} from '../src/learning.mjs';
test('learning cards retain identity when reordered and strip client statistics',()=>{const a=validateCards([{front:'A',back:'Answer A'},{front:'B',back:'Answer B'}]);const b=validateCards([{...a[1],stats:{correct:999}},a[0]]);assert.equal(b[0].cardId,a[1].cardId);assert.equal(b[1].cardId,a[0].cardId);assert.equal(b[0].stats,undefined);});
test('learning images reject SVG and a forged binary type',()=>{assert.throws(()=>validateCards([{front:'A',back:'B',image:'data:image/svg+xml;base64,PHN2Zz4='}]),/PNG/);assert.throws(()=>validateCards([{front:'A',back:'B',image:'data:image/png;base64,YWJjZGVmZ2hpamtsbW5vcA=='}]),/content/);});
test('duplicate card IDs cannot mix answer histories',()=>{const [c]=validateCards([{front:'A',back:'B'}]);assert.throws(()=>validateCards([c,c]),/duplicate/);});
