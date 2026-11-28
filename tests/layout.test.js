const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('course configuration is separate from inputs and output', () => {
  const ids = JSON.parse(fs.readFileSync(path.join(root, 'courses.json')));
  assert(ids.every(id => typeof id === 'string'));
  for (const id of ids) {
    const dir = path.join(root, 'courses', id);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['metadata.json', 'structure.json']);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json')));
    assert.equal(meta.id, id);
    assert(fs.existsSync(path.join(root, meta.sourcePath || meta.snapshotPath)));
  }
});
