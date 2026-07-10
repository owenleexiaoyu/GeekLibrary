# Geek Library 站点生成规范

## 目标

Geek Library 是一个纯静态课程网站。项目仓库只保存网站代码、课程元数据、课程结构文档和生成后的静态产物；原始课程文件夹不放进仓库，通过本地私有路径读取。

最终产物需要可以直接通过 GitHub Pages 在线浏览。

## 输入

每门课程需要两类输入：

1. 本地课程源文件夹路径。
2. 课程首页信息地址。

本地源路径写入 `course-sources.json`，该文件不提交到 GitHub。

示例：

```json
{
  "android-mastery": {
    "sourcePath": "/Users/lixiaoyu/Downloads/Android开发高手课"
  },
  "flutter-core": {
    "sourcePath": "/Users/lixiaoyu/Downloads/Flutter核心技术与实战"
  }
}
```

公开课程信息写入 `courses.json`，包括课程标题、讲师、介绍、课程首页地址、输出目录等。

## 课程结构文档

每门课程目录下必须有一份 `course-structure.json`，它是生成课程 HTML 产物的章节组织依据。

如果新增课程时还没有这份文件，构建器可以先根据本地课程源文件夹自动生成一份初稿；初稿生成后应作为后续构建的依据，并允许人工 review 和调整章节顺序、分组、标题。

文件位置：

```text
courses/<course-id>/course-structure.json
```

结构要求：

- 只描述网站里的课程组织信息。
- 必须包含 `section` 和 `chapter` 两层。
- `section` 和 `chapter` 都必须有稳定 `id`。
- 章节标题要去掉原始文件名前面的数字编号。
- 不要包含原始来源信息，例如 HTML、PDF、音频文件名、`sourceTypes` 等。

示例：

```json
{
  "id": "flutter-core",
  "title": "Flutter 核心技术与实战",
  "introUrl": "https://time.geekbang.org/column/intro/100031001",
  "sections": [
    {
      "id": "flutter-core-section-02",
      "title": "预习篇",
      "chapters": [
        {
          "id": "flutter-core-chapter-02-01",
          "title": "预习篇 · 从0开始搭建Flutter工程环境"
        }
      ]
    }
  ]
}
```

## 文件命名

课程章节 HTML 文件名必须使用 `course-structure.json` 里的 `chapter.id`。

示例：

```text
courses/flutter-core/site/flutter-core-chapter-02-01.html
courses/android-mastery/site/android-mastery-chapter-03-07.html
```

不要使用 `lesson-01.html` 这类顺序文件名。

课程阅读入口仍然是：

```text
courses/<course-id>/site/index.html
```

`site/index.html` 展示该课程第一章，并且内部侧栏、上一章、下一章链接都必须指向 `chapter.id.html`。

## 源内容处理

构建器根据 `course-structure.json` 的章节标题，在本地课程源目录中匹配对应源文件。

匹配规则：

1. 如果章节存在 HTML，只解析 HTML，不解析 PDF，也不使用 PDF 作为兜底。
2. 只有章节不存在 HTML 时，才允许解析 PDF。
3. 音频作为章节附件处理。

### HTML 章节

HTML 章节需要：

- 提取正文内容、图片和评论。
- 去掉原始 HTML 的样式、脚本、按钮、iframe 等无关内容。
- 去掉推广图片和邀请订阅相关内容。
- 规范代码块样式。
- 保留原文评论，并在章节底部展示。
- 图片复制到生成站点的 assets 目录，页面引用相对路径。

### PDF 章节

如果某个章节没有 HTML，只有 PDF，也必须生成 HTML 页面。只要匹配到了 HTML，即使同章节旁边也存在 PDF，也不能解析 PDF。

PDF 转换要求：

- 抽取 PDF 正文文本。
- 去掉 App 页眉、下载提示、讲述信息、时长、文件大小、上一章、下一章、版权声明、评论区等噪声。
- 去掉 PDF 中的私有图标字符和防盗水印残留。
- 在版权声明处截断，避免把评论区混入正文。
- 合并 PDF 断行造成的碎段落。
- 尽量识别小标题、图注和代码块。
- 在正文顶部标记该章节来自 PDF 转换。

PDF 转换提示样式示例：

```html
<section class="pdf-source-note">
  <span>PDF</span>
  <p>本章由 PDF 内容转化生成。</p>
</section>
```

### 音频章节

如果某个章节有音频文件，需要：

- 复制音频到对应课程站点的 `assets/audio/` 目录。
- 音频文件重命名为章节 id。
- 在章节正文顶部插入音频播放器。

示例：

```text
courses/flutter-core/site/assets/audio/flutter-core-chapter-06-08.m4a
```

播放器示例：

```html
<section class="lesson-audio">
  <div>
    <span>Audio</span>
    <strong>混合开发，该用何种方案管理导航栈？</strong>
  </div>
  <audio controls preload="metadata" src="assets/audio/flutter-core-chapter-06-08.m4a"></audio>
</section>
```

## 页面结构

课程阅读页必须包含：

- 左侧章节切换栏。
- 章节搜索。
- 当前章节正文。
- 正文底部上一章 / 下一章切换按钮。
- 评论区。
- 回到顶部按钮。

移动端需要支持侧栏抽屉。

## 设计要求

网站不能使用原始 HTML 自带样式。需要使用项目自己的独立设计语言。

原始内容只作为内容来源：

- 正文
- 图片
- 评论
- PDF 文本
- 音频

样式、布局、交互由项目统一控制。

## 多课程首页

项目根目录 `index.html` 是课程库首页，需要展示所有课程。

每门课程还需要课程介绍页：

```text
courses/<course-id>/index.html
```

课程介绍页内容来自 `courses.json` 中的结构化课程元数据。

## GitHub Pages

推荐发布方式：

1. 本地执行构建。
2. 提交生成后的静态文件。
3. GitHub Pages 选择从主分支根目录 `/` 发布。

GitHub 上不需要原始课程源文件，也不需要在线重新解析课程。

## 当前课程

当前站点包含三门课程：

1. Android 开发高手课
   - 课程 id：`android-mastery`
   - 课程首页地址：`https://time.geekbang.org/column/intro/100021101`
   - 输出目录：`courses/android-mastery`
   - 当前章节数：61

2. Flutter 核心技术与实战
   - 课程 id：`flutter-core`
   - 课程首页地址：`https://time.geekbang.org/column/intro/100031001`
   - 输出目录：`courses/flutter-core`
   - 当前章节数：46
   - 包含 PDF-only 章节
   - 包含音频章节

3. 朱涛 · Kotlin编程第一课
   - 课程 id：`kotlin-first-lesson`
   - 课程首页地址：`https://time.geekbang.org/column/intro/100103401`
   - 输出目录：`courses/kotlin-first-lesson`
   - 当前章节数：49

## 构建与验证

构建命令：

```bash
npm run build
```

本地预览：

```bash
npm run serve
```

构建后应验证：

- 首页能展示所有课程。
- 每门课 `site/index.html` 能打开。
- 章节文件名使用 `chapter.id.html`。
- 不存在旧的 `lesson-*.html`。
- 侧栏链接、上一章、下一章链接正确。
- PDF-only 章节没有明显噪声。
- 有音频的章节能看到播放器，音频文件路径可访问。
