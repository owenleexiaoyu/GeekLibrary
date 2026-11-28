# Geek Library

由 Node.js 构建的静态技术课程网站。课程配置、输入资料和网站产物分别存放，部署时只发布 `dist/`。

## 目录

```text
courses.json                       有序课程 ID 列表
courses/<id>/metadata.json          课程名称、讲师、简介、模块和输入路径
courses/<id>/structure.json         分组、章节顺序、标题和稳定 ID
sources/<id>/                      原始资料，保持原有格式
sources/<id>/site-snapshot/         缺少原始资料时使用的既有阅读页快照
scripts/                           注册、解析、构建脚本和共享配置读取
templates/library/                首页、课程介绍页样式与交互
templates/site/                   阅读页样式与交互
dist/                              全部网站产物，可删除后重新构建
tests/                             构建行为测试
```

`dist/` 内保留网站 URL 层级：`index.html` 为首页，`courses/<id>/index.html` 为课程介绍，`courses/<id>/site/` 为章节阅读页和资源。不要直接修改产物；下一次构建会覆盖它们。

## 构建和预览

```bash
npm install
npm test
npm run build
npm run serve
```

访问 `http://127.0.0.1:4173`。预览服务由 `scripts/serve.js` 提供，无需在线下载依赖；课程目录缺少末尾 `/` 时自动跳转到规范地址，确保相对链接正确，并支持音频分段读取。预览服务仅暴露 `dist/`，不会暴露配置和原始资料。仓库保留生成产物，静态服务器不需要 Node.js。

## 输入资料

当前提示词课程从 `sources/mastering-llm-prompting/` 中的 Markdown 与配图构建。支持 HTML、Markdown、PDF 和配套音频；PDF 提取需要 Python 与 pdfplumber。

Android、Flutter、Kotlin 暂时缺少配置可用的原始资料，已把迁移前的阅读页完整保存在各自的 `site-snapshot/`。这些是迁移快照输入，不是可编辑的文章源数据。构建会明确报告使用快照，并应用公共阅读页样式和交互；正文与页面内讲师信息维持快照内容。课程介绍仍从 metadata.json 生成。快照可确保从空 `dist/` 重建，不依赖旧产物。

如有仓库外的原始资料，复制配置示例：

```bash
cp course-sources.example.json course-sources.json
```

设置对应课程的 `sourcePath`，例如：

```json
{
  "kotlin-first-lesson": { "sourcePath": "/absolute/path/to/Kotlin课程" }
}
```

`course-sources.json` 不提交 Git。路径优先级：本机配置中的 sourcePath → metadata.json 中的 sourcePath → metadata.json 中的 snapshotPath。配置了有效原始资料后，会按 structure.json 重新生成阅读页；请先确认源资料覆盖全部章节。

## 添加和维护课程

```bash
npm run add-course -- --id example-course --source "/absolute/path/to/course" --intro "https://example.com/course"
```

命令登记课程 ID、生成 `courses/<id>/metadata.json`，并把资料路径写入本机配置；仅尝试从介绍页读取标题和摘要，其他信息需人工整理。随后执行 `npm run build`。缺少 structure.json 时，构建器可根据子目录中的课程文件或根层 Markdown 生成初稿，之后应检查章节顺序和分组。

- 修改课程展示信息：编辑 `courses/<id>/metadata.json`。
- 修改章节组织：编辑 `courses/<id>/structure.json`。
- 修改正文：编辑原始资料。
- 修改页面布局：编辑 scripts 中的页面生成模板。
- 修改样式与交互：编辑 `templates/`。

构建按 HTML、Markdown、PDF 的优先级读取章节，缺少正文会报告并生成提示页。构建会重新解析资料，仅在输出变化时写盘；目前没有解析缓存。构建清理不再属于目录的章节页面，未自动清理所有废弃资源。介绍页可读数量优先使用构建后的 course-manifest.json。

## 部署

只发布 `dist/`。GitHub Pages 应使用 GitHub Actions 上传该目录，或将其内容发布到专用分支；不要再把仓库根目录直接作为站点。`dist/.nojekyll` 由构建生成。本次目录调整不会自动更改远端 Pages 设置。

### GitHub Pages 工作流

仓库提供 `.github/workflows/pages.yml`：推送到 main 或手动运行时，安装依赖、执行测试、构建，并仅上传 dist，随后部署 Pages。

启用步骤：提交并推送工作流，在 GitHub 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**，再在 Actions 中运行 Deploy GitHub Pages。继续选择 main / (root) 会显示根目录 README，而不是 dist 首页。

GitHub Pages 发布站点上限为 1 GB。目前完整站点约 1.40 GB，主要体积来自音频，因此工作流会在体积检查时给出明确错误。部署前需要缩减资源，或把音频迁移到其他存储并更新引用；工作流不会自动删除音频。
