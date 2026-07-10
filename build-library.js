const fs = require("fs");
const path = require("path");
const courses = require("./courses.json");

const root = __dirname;
const assets = path.join(root, "assets");
const esc = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function writeIfChanged(file, content) {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(next)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function slash(file) {
  return file.split(path.sep).join("/");
}

function relativeFrom(file, target) {
  const relative = slash(path.relative(path.dirname(file), target));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function courseWithBuildInfo(course) {
  const manifest = readJson(path.join(root, course.folder, "site", "course-manifest.json"), {});
  return {
    ...course,
    availableLessons: Number.isFinite(manifest.lessonCount) ? manifest.lessonCount : course.availableLessons
  };
}

fs.mkdirSync(assets, { recursive: true });
writeIfChanged(path.join(assets, "library.css"), fs.readFileSync(path.join(root, "library-assets/style.css")));
writeIfChanged(path.join(assets, "library.js"), fs.readFileSync(path.join(root, "library-assets/app.js")));

const resolvedCourses = courses.map(courseWithBuildInfo);
const cards = resolvedCourses.map((course, index) => `
  <article class="course-card" style="--course-accent:${course.accent}" data-search="${esc(`${course.title} ${course.author} ${course.category}`.toLowerCase())}">
    <a class="course-visual" href="${encodeURI(course.folder)}/index.html">
      <span class="course-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="course-glyph">${esc(course.glyph || course.title.slice(0, 1))}</span>
      <span class="course-state">${esc(course.status)}</span>
    </a>
    <div class="course-card-body">
      <p class="kicker">${esc(course.category)} · ${course.totalLessons} 讲</p>
      <h2><a href="${encodeURI(course.folder)}/index.html">${esc(course.title)}</a></h2>
      <p>${esc(course.subtitle)}</p>
      <div class="course-card-meta"><span>${esc(course.author)}</span><span>${course.availableLessons} 篇已整理</span></div>
    </div>
  </article>`).join("");

const home = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Geek Library 技术课程知识库"><title>Geek Library · 技术课程知识库</title><link rel="stylesheet" href="assets/library.css"></head><body class="library-page">
<header class="library-nav"><a class="library-logo" href="index.html"><span>G</span>Geek Library</a><nav><a href="#courses">课程</a><span>${resolvedCourses.length} 门课程</span></nav></header>
<main><section class="library-hero"><div><p class="kicker">CURATED ENGINEERING COURSES</p><h1>把好课程，<br><em>变成真正可用的知识。</em></h1><p class="hero-copy">一个持续生长的技术课程书架。清晰的结构、舒服的阅读体验，以及随时可以继续的学习路径。</p></div><div class="hero-orbit"><span class="orbit-ring"></span><strong>${resolvedCourses.length}</strong><small>COURSES<br>AND GROWING</small></div></section>
<section class="course-library" id="courses"><header><div><p class="kicker">THE LIBRARY</p><h2>全部课程</h2></div><label class="library-search"><span>⌕</span><input type="search" placeholder="搜索课程或讲师" aria-label="搜索课程或讲师"></label></header><div class="course-grid">${cards}</div><p class="no-results" hidden>没有找到匹配的课程。</p></section></main>
<footer class="library-footer"><span>Geek Library</span><span>专注、深入、持续生长。</span></footer><script src="assets/library.js"></script></body></html>`;
let written = writeIfChanged(path.join(root, "index.html"), home) ? 1 : 0;

for (const course of resolvedCourses) {
  const introFile = path.join(root, course.folder, "index.html");
  const cssPath = relativeFrom(introFile, path.join(root, "assets", "library.css"));
  const homePath = relativeFrom(introFile, path.join(root, "index.html"));
  const studyPath = "site/index.html";
  const intro = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(course.summary)}"><title>${esc(course.title)} · Geek Library</title><link rel="stylesheet" href="${cssPath}"></head><body class="intro-page" style="--course-accent:${course.accent}">
  <header class="library-nav intro-nav"><a class="library-logo" href="${homePath}"><span>G</span>Geek Library</a><nav><a href="${homePath}">全部课程</a><a class="nav-study" href="${studyPath}">开始学习</a></nav></header>
  <main>
    <section class="intro-hero"><div class="intro-copy"><p class="kicker">${esc(course.category)} · ${esc(course.status)}</p><h1>${esc(course.title)}</h1><p class="intro-subtitle">${esc(course.subtitle)}</p><p class="intro-summary">${esc(course.summary)}</p><div class="intro-actions"><a class="primary-action" href="${studyPath}">开始学习 <span>→</span></a><a class="text-action" href="#outline">查看课程大纲 ↓</a></div></div>
      <aside class="course-poster"><div class="poster-grid"></div><span class="poster-mark">${esc(course.glyph || course.title.slice(0, 1))}</span><p>${esc((course.shortTitle || course.title).toUpperCase())}<br>MASTERY</p><div class="poster-stats"><span><b>${course.totalLessons}</b>讲课程</span><span><b>${esc(course.students)}</b>人学习</span><span><b>${course.availableLessons}</b>篇可读</span></div></aside>
    </section>
    <section class="intro-metrics"><span>讲师 <b>${esc(course.author)}</b></span><span>身份 <b>${esc(course.authorTitle)}</b></span><span>内容 <b>图文 · 实战 · 评论</b></span></section>
    <section class="intro-section outcomes"><div class="section-heading"><p class="kicker">WHAT YOU WILL LEARN</p><h2>你将获得</h2></div><div class="outcome-grid">${course.benefits.map((item, i) => `<article><span>0${i + 1}</span><p>${esc(item)}</p></article>`).join("")}</div></section>
    <section class="intro-section outline" id="outline"><div class="section-heading"><p class="kicker">COURSE OUTLINE</p><h2>课程脉络</h2><p>从具体问题进入，逐步走向效率与架构。</p></div><div class="module-list">${course.modules.map(module => `<article><span>${esc(module.number)}</span><div><h3>${esc(module.title)}</h3><p>${esc(module.description)}</p></div></article>`).join("")}</div></section>
    <section class="intro-section audience"><div><p class="kicker">WHO IT IS FOR</p><h2>这门课适合谁</h2></div><ul>${course.audience.map(item => `<li>${esc(item)}</li>`).join("")}</ul></section>
    <section class="teacher"><div class="teacher-avatar">${esc(course.author.slice(0, 1))}</div><div><p class="kicker">YOUR INSTRUCTOR</p><h2>${esc(course.author)}</h2><h3>${esc(course.authorTitle)}</h3><p>${esc(course.authorBio)}</p></div></section>
    <section class="start-panel"><p class="kicker">READY TO START?</p><h2>从第一篇开始，建立你的<br>高质量开发方法论。</h2><a class="primary-action" href="${studyPath}">进入课程 <span>→</span></a></section>
  </main><footer class="library-footer"><a href="${homePath}">← 返回课程库</a><span>课程资料整理自课程介绍与本地文章</span></footer></body></html>`;
  if (writeIfChanged(introFile, intro)) written++;
}

console.log(`Built library metadata: wrote ${written} page(s), reused ${resolvedCourses.length + 1 - written}.`);
