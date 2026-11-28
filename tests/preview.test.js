const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPreviewServer } = require('../scripts/serve');
test('preview canonicalizes course directories and serves chapters and audio', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geek-preview-'));
  const dir = path.join(root, 'courses/example/site');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, 'courses/example/index.html'), '<a href="site/index.html">进入课程</a>');
  fs.writeFileSync(path.join(dir, 'index.html'), '课程内容');
  fs.writeFileSync(path.join(dir, 'sample.m4a'), '0123456789');
  const server = createPreviewServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const redirect = await fetch(base + '/courses/example', { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/courses/example/');
    const intro = await fetch(base + redirect.headers.get('location'));
    const href = (await intro.text()).match(/href="([^"]+)"/)[1];
    const chapter = await fetch(new URL(href, intro.url));
    assert.equal(chapter.status, 200);
    assert.equal(await chapter.text(), '课程内容');
    const audio = await fetch(base + '/courses/example/site/sample.m4a', { headers: { Range: 'bytes=2-5' } });
    assert.equal(audio.status, 206);
    assert.equal(audio.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await audio.text(), '2345');
    assert.equal((await fetch(base + '/courses/site/index.html')).status, 404);
    assert.equal((await fetch(base + '/courses.json')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});
