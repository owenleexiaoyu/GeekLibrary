const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const context = { require: require('node:module').createRequire(path.join(root, 'build-site.js')), __dirname: root, console, Buffer };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'build-site.js'), 'utf8').split('const sourceMap = readSourceMap();')[0], context);
test('Markdown chapters preserve formatting, local images and numeric order', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-course-'));
  try {
    fs.mkdirSync(path.join(temp, 'assets'));
    fs.writeFileSync(path.join(temp, 'assets', 'example.png'), 'image fixture');
    fs.writeFileSync(path.join(temp, '2-第二课.md'), '## 内容\n\n**重点**\n\n```markdown\n# 提示词角色\n```\n\n![示例](assets/example.png)\n\n| 项目 | 值 |\n| --- | --- |\n| A | B |');
    fs.writeFileSync(path.join(temp, '10-第十课.md'), '正文');
    const course = { id: 'fixture', title: '测试' };
    const structure = context.generateStructure(course, temp);
    assert.equal(structure.sections.flatMap(s => s.chapters).length, 2);
    assert.equal(structure.sections[0].chapters[0].title, '第二课');
    const output = path.join(temp, 'site');
    const assets = path.join(output, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    const result = context.buildLessons(course, temp, structure, assets, output);
    assert.equal(result.missing.length, 0);
    assert.match(result.lessons[0].content, /<strong>重点<\/strong>/);
    assert.match(result.lessons[0].content, /<table>/);
    assert.match(result.lessons[0].content, /<code[^>]*># 提示词角色/);
    const image = result.lessons[0].content.match(/src="([^"]+)"/)[1];
    assert.equal(fs.readFileSync(path.join(output, image), 'utf8'), 'image fixture');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
