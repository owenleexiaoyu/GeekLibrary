# Geek Library

一个纯静态技术课程网站。仓库只保存网站代码、课程元数据和已经生成好的静态页面；原始课程 HTML 文件夹可以放在仓库外，通过本地私有配置读取。

## 本地构建

```bash
npm install
cp course-sources.example.json course-sources.json
npm run build
npm run serve
```

访问 `http://localhost:4173`。

`course-sources.json` 是本机私有文件，已经加入 `.gitignore`。它用于告诉构建器每门课程的原始 HTML 文件夹在哪里：

```json
{
  "android-mastery": {
    "sourcePath": "/Users/you/Courses/27-Android开发高手课"
  }
}
```

## 添加课程

添加一门课程需要两类信息：

1. 原始课程 HTML 文件夹路径：写入本地的 `course-sources.json`。
2. 课程首页信息地址：写入 `courses.json` 的 `introUrl`，并把介绍页需要展示的标题、讲师、摘要、模块等信息整理成结构化字段。

可以用命令生成或更新课程配置：

```bash
npm run add-course -- --source "/Users/you/Courses/某门课程" --intro "https://time.geekbang.org/column/intro/xxxx"
```

这个命令会：

- 把本地源路径写入 `course-sources.json`。
- 把课程介绍地址写入 `courses.json`。
- 尽量从介绍页读取标题和摘要；如果网页限制抓取，会生成“待补充”的课程骨架，之后手动补齐即可。

`courses.json` 是会提交到 GitHub 的公开配置；`course-sources.json` 不提交。这样仓库可以保持为纯网站项目，不携带原始课程文件。

## 增量构建

构建器会为每门课程在输出目录保存 `.build-cache.json`：

- 源 HTML 内容没变：直接复用上次提取的正文、图片和评论。
- 新增或修改 HTML：只重新解析变化的文件。
- 最终 HTML 内容没变：不会重复写盘。
- 删除源 HTML：对应的旧章节页面会被清理。

## 目录约定

当前 Android 课程输出到：

```text
courses/android-mastery/
├── index.html
└── site/
    ├── index.html
    ├── android-mastery-chapter-01-01.html
    └── assets/
```

原始目录 `27-Android开发高手课/` 不再是网站目录。你可以把它移到仓库外，然后把新路径写到 `course-sources.json`。

## GitHub 在线浏览

推荐使用 GitHub Pages，直接发布仓库根目录：

1. 把构建后的静态页面提交到 GitHub。
2. 进入仓库 Settings → Pages。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择主分支，目录选择 `/ (root)`。
5. 保存后访问 GitHub Pages 给出的地址。

因为原始课程 HTML 不在仓库里，GitHub 上不需要重新构建课程内容；它只负责托管已经生成好的静态站点。
