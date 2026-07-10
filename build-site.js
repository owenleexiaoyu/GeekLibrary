const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execFileSync } = require("child_process");
const cheerio = require("cheerio");

const projectRoot = __dirname;
const courses = require("./courses.json");
const sourceConfigFile = path.join(projectRoot, "course-sources.json");
const cacheVersion = 4;
const bundledPython = path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3");

const text = value => String(value || "").replace(/\s+/g, " ").trim();
const esc = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const digest = value => crypto.createHash("sha1").update(value).digest("hex");
const slug = lesson => `${lesson.id}.html`;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeIfChanged(file, content) {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(next)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function readSourceMap() {
  const saved = readJson(sourceConfigFile, {});
  const normalized = {};
  for (const [id, value] of Object.entries(saved)) {
    normalized[id] = typeof value === "string" ? { sourcePath: value } : value;
  }
  return normalized;
}

function resolveSourcePath(course, sourceMap) {
  const configured = sourceMap[course.id]?.sourcePath || course.sourcePath;
  if (!configured) return "";
  return path.resolve(projectRoot, configured);
}

function readStructure(course) {
  const file = path.join(projectRoot, course.folder, "course-structure.json");
  const structure = readJson(file, null);
  if (!structure?.sections?.length) throw new Error(`Missing course structure: ${file}`);
  return structure;
}

function normalizeTitle(value) {
  return text(value)
    .replace(/\.(html|pdf|m4a|mp3|wav|aac)$/i, "")
    .replace(/^0*\d+\s*[丨|｜·、.\-]?\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[?？!！:：,，。、“”"'\-—·]/g, "")
    .toLowerCase();
}

function cleanTitle(value) {
  return text(value)
    .replace(/\.(html|pdf|m4a|mp3|wav|aac)$/i, "")
    .replace(/^0*\d+\s*[丨|｜·、.\-]?\s*/, "");
}

function sourceIndex(sourceRoot) {
  const map = new Map();
  for (const file of walk(sourceRoot)) {
    if (file.includes(`${path.sep}site${path.sep}`)) continue;
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!["html", "pdf", "m4a", "mp3", "wav", "aac"].includes(ext)) continue;
    const key = normalizeTitle(path.basename(file));
    if (!map.has(key)) map.set(key, {});
    map.get(key)[ext === "m4a" || ext === "mp3" || ext === "wav" || ext === "aac" ? "audio" : ext] = file;
  }
  return map;
}

function findSource(index, chapter) {
  const key = normalizeTitle(chapter.title);
  if (index.has(key)) return index.get(key);
  let best = null;
  for (const [candidateKey, files] of index) {
    if (candidateKey.includes(key) || key.includes(candidateKey)) {
      const score = Math.abs(candidateKey.length - key.length);
      if (!best || score < best.score) best = { files, score };
    }
  }
  return best?.files || {};
}

function removePromos($, article) {
  article.find("script,style,iframe,button").remove();
  article.find("p").each((_, element) => {
    const node = $(element);
    if (/请朋友读|邀请订阅|现金奖励/.test(text(node.text()))) {
      node.nextAll().remove();
      node.remove();
    }
  });
  article.find("img").each((_, element) => {
    const node = $(element);
    const source = node.attr("data-savepage-src") || node.attr("src") || "";
    if (/bf8fdc35ddccb10b1161d8ca7eb8f8f1|24c190870d71c3daa203a939d67358c0|306ef8892cc985a19fdd36534e7c5daa/.test(source)) {
      const paragraph = node.closest("p");
      (paragraph.length ? paragraph : node).remove();
    }
  });
}

function cleanArticle($, article, title, key, assetsDir) {
  removePromos($, article);
  article.find("pre").each((_, element) => {
    const block = $(element);
    const code = text(block.find("code").first().text() || block.text().replace(/复制代码/g, ""));
    block.empty().append($("<code></code>").text(code));
  });

  const lessonAssets = [];
  article.find("img").each((index, element) => {
    const node = $(element);
    const source = node.attr("src") || node.attr("data-savepage-src");
    const match = source?.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.*)$/s);
    if (match) {
      const ext = match[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
      const name = `${digest(key).slice(0, 10)}-image-${index + 1}.${ext}`;
      writeIfChanged(path.join(assetsDir, name), Buffer.from(match[2], "base64"));
      lessonAssets.push(`assets/${name}`);
      node.attr("src", `assets/${name}`);
    } else if (node.attr("data-savepage-src")) {
      node.attr("src", node.attr("data-savepage-src"));
    }
    node.attr({ loading: "lazy", alt: node.attr("alt") || `${title}配图` });
  });

  article.find("*").each((_, element) => {
    const node = $(element);
    for (const name of Object.keys(element.attribs || {})) {
      if (!["src", "alt", "href", "loading", "colspan", "rowspan"].includes(name)) node.removeAttr(name);
    }
  });

  return lessonAssets;
}

function parseHtmlLesson(course, chapter, htmlFile, assetsDir, sourceRoot) {
  const source = fs.readFileSync(htmlFile);
  const key = path.relative(sourceRoot, htmlFile);
  const $ = cheerio.load(source);
  const title = chapter.title || cleanTitle($("h1").first().text()) || cleanTitle(path.basename(htmlFile));
  const article = $("._3IatBmhv_0").first();
  if (!article.length) return null;

  const assets = cleanArticle($, article, title, key, assetsDir);
  const comments = [];
  $("li.reJj6Thl_0").each((_, item) => {
    const node = $(item);
    const content = text(node.find("._3M6kV3zb_0").first().text());
    if (content) {
      comments.push({
        name: text(node.find("._18Dng5rT_0 span").first().text()) || "匿名读者",
        date: text(node.find("._1H1Z49Dr_0").first().text()),
        likes: text(node.find("._2P4B1Hdm_0 span").first().text()),
        content
      });
    }
  });

  const meta = text($("h1").first().next().text());
  return {
    title,
    date: meta.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "",
    content: article.html(),
    comments,
    minutes: Math.max(2, Math.round(text(article.text()).length / 450)),
    assets
  };
}

function pdfToHtml(pdfFile, title) {
  const python = fs.existsSync(bundledPython) ? bundledPython : "python3";
  const script = `
import json, sys
import pdfplumber
path = sys.argv[1]
pages = []
with pdfplumber.open(path) as pdf:
    for page in pdf.pages:
        txt = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
        txt = txt.strip()
        if txt:
            pages.append(txt)
print(json.dumps(pages, ensure_ascii=False))
`;
  const output = execFileSync(python, ["-c", script, pdfFile], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  const pages = JSON.parse(output || "[]");
  const lines = cleanPdfLines(pages, title);
  const blocks = pdfLinesToBlocks(lines);
  return blocksToHtml(blocks, title);
}

function stripPdfNoise(value) {
  return text(value)
    .replace(/[\ue000-\uf8ff]/g, "")
    .replace(/复制代码/g, "")
    .replace(/([：:])\s*\d+$/g, "$1")
    .replace(/^([信微课拼])+(\s*(export|flutter|open -a|git|cd|mkdir|sudo|brew|pub|PATH=|[A-Z_]+=))/, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPdfLines(pages, title) {
  const normalizedTitle = normalizeTitle(title);
  const result = [];
  let stopped = false;
  for (const page of pages) {
    for (const raw of String(page).split(/\r?\n/)) {
      if (stopped) break;
      let line = stripPdfNoise(raw);
      if (!line) continue;
      if (/版权归极客邦科技所有/.test(line)) {
        stopped = true;
        break;
      }
      if (/^(下载APP|进入课程|讲述[:：]|时长\s*\d|上一篇|下一篇)/.test(line)) continue;
      if (/^\d{4}-\d{2}-\d{2}\s+/.test(line)) continue;
      if (/^Flutter核心技术与实战/.test(line)) continue;
      if (/^[\d\s]+$/.test(line)) continue;
      if (/^[信微课拼]$/.test(line)) continue;
      if (/^页面已增加防盗追踪/.test(line)) continue;
      const normalizedLine = normalizeTitle(line.replace(/^\d+\s*[|丨｜]\s*/, ""));
      if (!normalizedLine || normalizedLine === normalizedTitle) continue;
      result.push(line);
    }
    if (stopped) break;
  }
  return result;
}

function isPdfHeading(line) {
  if (/^图\s*\d+/.test(line)) return false;
  if (/[。！？；，,：:、]$/.test(line)) return false;
  if (line.length > 28) return false;
  return /^(准备工作|安装|配置|运行|思考题|iOS|Android|Flutter|Dart|开发|工具链|总结)/.test(line) || /^[\u4e00-\u9fa5A-Za-z ]{2,18}$/.test(line);
}

function isSentenceEnd(line) {
  return /[。！？；：:）)]$/.test(line) || /^图\s*\d+/.test(line);
}

function pdfLinesToBlocks(lines) {
  const blocks = [];
  let paragraph = "";
  let code = [];
  let codeMode = false;
  const flushParagraph = () => {
    if (paragraph) blocks.push({ type: "p", text: paragraph.trim() });
    paragraph = "";
  };
  const flushCode = () => {
    if (code.length) blocks.push({ type: "code", text: code.join("\n") });
    code = [];
    codeMode = false;
  };

  for (const line of lines) {
    const cleanedCodeLine = line.replace(/^([信微课拼])+/, "");
    const numberedCode = cleanedCodeLine.match(/^\d+\s+(.+)$/);
    const commandLike = /^(export |flutter |open -a |git |cd |mkdir |sudo |brew |pub |PATH=|[A-Z_]+=)/.test(cleanedCodeLine);
    if (numberedCode || (codeMode && commandLike)) {
      flushParagraph();
      codeMode = true;
      const codeText = (numberedCode ? numberedCode[1] : cleanedCodeLine)
        .replace(/^[信微课拼]+(?=export|flutter|open -a|git|cd|mkdir|sudo|brew|pub|PATH=|[A-Z_]+=)/, "");
      code.push(codeText);
      continue;
    }
    if (codeMode) flushCode();

    if (/^图\s*\d+/.test(line)) {
      flushParagraph();
      blocks.push({ type: "caption", text: line });
      continue;
    }
    if (isPdfHeading(line)) {
      flushParagraph();
      blocks.push({ type: "h2", text: line });
      continue;
    }
    paragraph += paragraph ? line : line;
    if (isSentenceEnd(line)) flushParagraph();
  }
  flushParagraph();
  flushCode();
  return blocks;
}

function blocksToHtml(blocks, title) {
  const html = blocks
    .filter(block => normalizeTitle(block.text) !== normalizeTitle(title))
    .map(block => {
      if (block.type === "h2") return `<h2>${esc(block.text)}</h2>`;
      if (block.type === "caption") return `<center><span>${esc(block.text)}</span></center>`;
      if (block.type === "code") return `<pre><code>${esc(block.text)}</code></pre>`;
      return `<p>${esc(block.text)}</p>`;
    })
    .join("\n");
  return html || `<p>这个章节来自 PDF，暂时没有抽取到可读文本。</p>`;
}

function parsePdfLesson(chapter, pdfFile) {
  const title = chapter.title || cleanTitle(path.basename(pdfFile));
  const content = `<section class="pdf-source-note"><span>PDF</span><p>本章由 PDF 内容转化生成。</p></section>\n${pdfToHtml(pdfFile, title)}`;
  const plain = text(content.replace(/<[^>]+>/g, " "));
  return { title, date: "", content, comments: [], minutes: Math.max(2, Math.round(plain.length / 450)), assets: [] };
}

function copyAudio(course, chapter, audioFile, outputDir) {
  if (!audioFile) return null;
  const ext = path.extname(audioFile).slice(1).toLowerCase() || "m4a";
  const name = `${chapter.id}.${ext}`;
  const target = path.join(outputDir, "assets", "audio", name);
  writeIfChanged(target, fs.readFileSync(audioFile));
  return `assets/audio/${name}`;
}

function audioBlock(src, title) {
  if (!src) return "";
  return `<section class="lesson-audio"><div><span>Audio</span><strong>${esc(title)}</strong></div><audio controls preload="metadata" src="${esc(src)}"></audio></section>`;
}

function buildLessons(course, sourceRoot, structure, assetsDir, outputDir) {
  const index = sourceIndex(sourceRoot);
  const lessons = [];
  const missing = [];
  const liveAssetPaths = new Set();

  for (const section of structure.sections) {
    for (const chapter of section.chapters) {
      const sources = findSource(index, chapter);
      let parsed = null;
      if (sources.html) parsed = parseHtmlLesson(course, chapter, sources.html, assetsDir, sourceRoot);
      if (!parsed && sources.pdf) parsed = parsePdfLesson(chapter, sources.pdf);
      if (!parsed) {
        missing.push(chapter.title);
        parsed = {
          title: chapter.title,
          date: "",
          content: `<p class="empty-comments">未找到这个章节的 HTML 或 PDF 源文件。</p>`,
          comments: [],
          minutes: 2,
          assets: []
        };
      }
      const audio = copyAudio(course, chapter, sources.audio, outputDir);
      if (audio) liveAssetPaths.add(audio);
      for (const asset of parsed.assets || []) liveAssetPaths.add(asset);
      lessons.push({
        id: chapter.id,
        title: chapter.title || parsed.title,
        sectionId: section.id,
        section: section.title,
        date: parsed.date,
        content: `${audioBlock(audio, chapter.title)}${parsed.content}`,
        comments: parsed.comments,
        minutes: parsed.minutes,
        audio
      });
    }
  }

  return { lessons, missing, liveAssetPaths };
}

function sidebar(course, lessons, current, structure) {
  return structure.sections.map(section => {
    const items = lessons.map((lesson, index) => ({ lesson, index })).filter(item => item.lesson.sectionId === section.id);
    if (!items.length) return "";
    return `<section class="nav-section"><h2>${esc(section.title)}<span>${items.length}</span></h2><div class="nav-lessons">${
      items.map(({ lesson, index }) => `<a href="${slug(lesson)}" class="${index === current ? "active" : ""}" data-title="${esc(lesson.title.toLowerCase())}"><span>${String(index + 1).padStart(2, "0")}</span><em>${esc(lesson.title)}</em></a>`).join("")
    }</div></section>`;
  }).join("");
}

function commentCards(items) {
  if (!items.length) return `<p class="empty-comments">这篇文章暂时没有读者留言。</p>`;
  return items.map(comment => `<article class="comment"><div class="avatar">${esc(comment.name.slice(0, 1).toUpperCase())}</div><div class="comment-body"><header><strong>${esc(comment.name)}</strong><span>${esc(comment.date)}</span>${comment.likes ? `<span class="likes">♡ ${esc(comment.likes)}</span>` : ""}</header><p>${esc(comment.content)}</p></div></article>`).join("");
}

function page(course, lessons, lesson, index, structure) {
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const shortTitle = lesson.title.replace(/\s*[|丨]\s*/g, " · ");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(lesson.title)}"><title>${esc(lesson.title)} · ${esc(course.title)}</title><link rel="stylesheet" href="assets/style.css"></head><body>
<div class="reading-progress"></div><aside class="sidebar"><a class="brand" href="index.html"><span class="brand-mark">${esc(course.glyph || course.title.slice(0, 1))}</span><span><b>${esc(course.shortTitle || course.title)}</b><small>${esc(course.subtitle || "")}</small></span></a><label class="search"><span>⌕</span><input id="lesson-search" type="search" placeholder="搜索章节" aria-label="搜索章节"></label><nav>${sidebar(course, lessons, index, structure)}</nav><footer><span class="status-dot"></span>离线教程 · ${lessons.length} 章</footer></aside>
<button class="menu-button" type="button" aria-label="打开章节目录" aria-expanded="false">☰</button><button class="scrim" type="button" aria-label="关闭章节目录"></button>
<main><div class="topline"><span>${esc(lesson.section)}</span><span>第 ${index + 1} / ${lessons.length} 章</span></div><article class="lesson"><header class="lesson-header"><p class="eyebrow">${esc((course.kicker || course.title).toUpperCase())} · LESSON ${String(index + 1).padStart(2, "0")}</p><h1>${esc(shortTitle)}</h1><div class="meta"><span>${esc(course.lessonAuthor || course.author || "")}</span>${lesson.date ? `<span>${esc(lesson.date)}</span>` : ""}<span>约 ${lesson.minutes} 分钟</span></div></header>
<div class="article-content">${lesson.content}</div><nav class="pager" aria-label="章节导航">${prev ? `<a href="${slug(prev)}"><small>← 上一章</small><strong>${esc(prev.title)}</strong></a>` : `<span></span>`}${next ? `<a class="next" href="${slug(next)}"><small>下一章 →</small><strong>${esc(next.title)}</strong></a>` : `<span></span>`}</nav>
<section class="comments"><header><div><p class="eyebrow">COMMUNITY NOTES</p><h2>读者评论</h2></div><span>${lesson.comments.length} 条</span></header>${commentCards(lesson.comments)}</section></article></main><button class="back-to-top" type="button" aria-label="回到顶部">↑</button><script src="assets/app.js"></script></body></html>`;
}

function cleanStaleFiles(output, expectedPages) {
  if (!fs.existsSync(output)) return;
  for (const file of fs.readdirSync(output)) {
    if ((/^lesson-\d+\.html$/.test(file) || /^.+-chapter-\d{2}-\d{2}\.html$/.test(file)) && !expectedPages.has(file)) fs.rmSync(path.join(output, file));
  }
}

function buildCourse(course, sourceRoot) {
  const output = path.join(projectRoot, course.folder, "site");
  const assets = path.join(output, "assets");
  fs.mkdirSync(assets, { recursive: true });
  const structure = readStructure(course);
  const { lessons, missing } = buildLessons(course, sourceRoot, structure, assets, output);
  let written = 0;

  const expectedPages = new Set(lessons.map(lesson => slug(lesson)));
  cleanStaleFiles(output, expectedPages);
  lessons.forEach((lesson, index) => {
    if (writeIfChanged(path.join(output, slug(lesson)), page(course, lessons, lesson, index, structure))) written++;
  });
  if (lessons[0] && writeIfChanged(path.join(output, "index.html"), page(course, lessons, lessons[0], 0, structure))) written++;
  writeIfChanged(path.join(assets, "style.css"), fs.readFileSync(path.join(projectRoot, "site-assets/style.css")));
  writeIfChanged(path.join(assets, "app.js"), fs.readFileSync(path.join(projectRoot, "site-assets/app.js")));
  writeIfChanged(path.join(output, "course-manifest.json"), JSON.stringify({ id: course.id, lessonCount: lessons.length }, null, 2));

  return { id: course.id, lessons: lessons.length, written, missing };
}

const sourceMap = readSourceMap();
const results = [];

for (const course of courses) {
  const sourceRoot = resolveSourcePath(course, sourceMap);
  if (!sourceRoot || !fs.existsSync(sourceRoot)) {
    results.push(`${course.id}: skipped, no local sourcePath configured`);
    continue;
  }
  const result = buildCourse(course, sourceRoot);
  results.push(`${course.id}: built ${result.lessons} lessons, wrote ${result.written} page(s)${result.missing.length ? `, missing ${result.missing.length}` : ""}`);
  for (const title of result.missing) results.push(`  missing: ${title}`);
}

console.log(results.join("\n"));
