# Geek Library 站点生成规范

## 数据边界

- courses.json：有序课程 ID 数组。
- courses/<id>/metadata.json：公开课程元信息与输入路径；id 必须和目录一致。
- courses/<id>/structure.json：sections / chapters 两层结构，每项有稳定 id 和标题；不包含源文件名和类型。
- sources/：原始资料；不改写原文件格式、内容和配图。
- scripts/：构建和注册代码；templates/：公共样式与交互源文件。
- dist/：全部生成页面和资源，只发布此目录，可从输入完整重建。

## 迁移兼容

Android、Flutter、Kotlin 的原始资料暂不可用。sources/<id>/site-snapshot 保存迁移前完整阅读站点，metadata.json 用 snapshotPath 指定它。快照属于兼容输入，不能宣称由原始文章生成。优先使用可用的 sourcePath；否则恢复快照并明确报告。两者都不存在时构建失败，避免静默遗漏课程。

## 构建流程

1. 加载课程列表和独立元信息。
2. 读取私有 course-sources.json（优先）或元信息中的 sourcePath。
3. 原始资料可用时，根据 structure.json 匹配正文、图片与音频，生成 dist/courses/<id>/site/；没有目录时尝试自动生成。
4. 没有可用资料时恢复 HTML 快照，复制公共阅读样式和交互。
5. 从 metadata.json 与各课程 course-manifest.json 生成首页、课程介绍页。
6. 输出内容不变时不重复写盘；不使用解析缓存。

## 验证要求

运行 npm test 和 npm run build。目录迁移须检查原始资料哈希不变、从空 dist 构建、站内相对链接和资源有效、重复构建输出稳定。

## 部署

静态服务器仅托管 dist/。GitHub Pages 通过 Actions 上传 dist 或专用发布分支托管其内容，不发布配置和 sources。
