const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const root = path.resolve(__dirname, "..");
const coursesFile = path.join(root, "courses.json");
const sourcesFile = path.join(root, "course-sources.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith("--")) parsed[arg.slice(2)] = args[index + 1];
  }
  if (!parsed.source || !parsed.intro) {
    console.error("Usage: npm run add-course -- --source \"/path/to/course-html\" --intro \"https://time.geekbang.org/column/intro/...\" [--id course-id]");
    process.exit(1);
  }
  return parsed;
}

function slugify(value) {
  const ascii = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (ascii) return ascii;
  const digits = String(value).match(/\d+/g)?.join("-");
  return digits ? `course-${digits}` : `course-${Date.now()}`;
}

async function fetchIntro(url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 GeekLibraryBuilder/1.0" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = ($('meta[property="og:title"]').attr("content") || $("title").first().text() || "").replace(/[-_丨|].*$/, "").trim();
    const summary = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
    return { title, summary };
  } catch (error) {
    return { title: "", summary: "", error: error.message };
  }
}

async function main() {
  const args = parseArgs();
  const sourcePath = path.resolve(root, args.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source path does not exist: ${sourcePath}`);
    process.exit(1);
  }

  const courseIds = readJson(coursesFile, []);
  const courses = require("./config").loadCourses();
  const sources = readJson(sourcesFile, {});
  const intro = await fetchIntro(args.intro);
  const folderTitle = path.basename(sourcePath).replace(/^\d+[-_、.\s]*/, "");
  const title = intro.title || folderTitle;
  const id = args.id || courses.find(course => course.introUrl === args.intro)?.id || slugify(title || args.intro);
  const existing = courses.find(course => course.id === id);
  const course = existing || {
    id,
    title,
    shortTitle: title,
    glyph: title.slice(0, 1).toUpperCase(),
    kicker: title,
    subtitle: "待补充课程副标题",
    author: "待补充讲师",
    lessonAuthor: "待补充讲师",
    authorTitle: "待补充讲师介绍",
    category: "技术课程",
    status: "待整理",
    totalLessons: 0,
    availableLessons: 0,
    students: "-",
    accent: "#b9ed86",
    introUrl: args.intro,
    summary: intro.summary || "待补充课程简介。",
    benefits: ["待补充课程收获"],
    audience: ["待补充适合人群"],
    modules: [{ number: "01", title: "课程正文", description: "待补充课程模块介绍。" }],
    authorBio: "待补充讲师简介。"
  };

  course.introUrl = args.intro;
  if (intro.title && (!existing || existing.title.startsWith("course-"))) course.title = intro.title;
  if (intro.summary && (!existing || existing.summary === "待补充课程简介。")) course.summary = intro.summary;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid course id: ${id}`);
  if (!existing) courseIds.push(id);
  delete course.folder;

  sources[id] = { sourcePath };
  const courseDir = path.join(root, "courses", id);
  fs.mkdirSync(courseDir, { recursive: true });
  writeJson(path.join(courseDir, "metadata.json"), course);
  writeJson(coursesFile, courseIds);
  writeJson(sourcesFile, sources);

  console.log(`Registered ${id}`);
  if (intro.error) console.log(`Intro page was not fetched automatically: ${intro.error}`);
  console.log("Next: review courses/<id>/metadata.json, then run npm run build.");
}

main();
