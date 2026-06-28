 # 贡献指南
 
 感谢你对 Chowda Blog 的关注！以下是一些参与贡献的指引。
 
 ## 提交 Issue
 
 - **Bug 报告**: 请使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/01-bug_report.yml)，清晰描述问题、复现步骤和环境信息
 - **功能建议**: 请使用 [Feature Request 模板](.github/ISSUE_TEMPLATE/02-feature_request.yml)，描述你期望的功能和使用场景
 - **其他问题**: 请使用 [Custom Issue 模板](.github/ISSUE_TEMPLATE/03-custom_issue.yml)
 
 ## 提交 Pull Request
 
 1. Fork 本仓库
 2. 创建你的特性分支：`git checkout -b feat/amazing-feature`
 3. 提交你的改动：`git commit -m "feat: add amazing feature"`
 4. 推送到你的 Fork：`git push origin feat/amazing-feature`
 5. 创建 Pull Request
 
 ### Commit 规范
 
 使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：
 
 - `feat:` 新功能
 - `fix:` 修复 Bug
 - `docs:` 文档更新
 - `style:` 代码格式调整
 - `refactor:` 重构
 - `perf:` 性能优化
 - `test:` 测试相关
 - `chore:` 构建/工具相关
 
 ### 代码规范
 
 - 使用 TypeScript 编写，确保类型安全
 - 使用 Biome 格式化代码：`pnpm format`
 - 提交前运行 `pnpm check` 检查代码
 - 遵循项目的目录结构和命名约定
 
 ## 开发环境
 
 ```bash
 pnpm install    # 安装依赖
 pnpm dev        # 启动开发服务器
 pnpm build      # 构建生产版本
 pnpm check      # 代码检查
 ```
 
 ## 行为准则
 
 请参阅 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
