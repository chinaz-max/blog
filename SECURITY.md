 # 安全政策
 
 ## 报告安全漏洞
 
 如果你发现 Chowda Blog 存在安全漏洞，请通过以下方式报告：
 
 - 在 GitHub 上创建一个 [Security Issue](https://github.com/chinaz-max/blog/issues/new?template=03-custom_issue.yml)
 - 或直接在仓库中提交 Issue（非敏感安全问题）
 
 对于敏感的安全问题，请不要在公开 Issue 中披露，而是通过 GitHub 的私有安全报告功能提交。
 
 ## 安全最佳实践
 
 - 本项目为静态博客站点，不涉及用户登录或数据库
 - 所有依赖通过 Dependabot 自动检查更新
 - 建议在生产环境中启用 HTTPS（GitHub Pages 自动提供）
 - 部署时确保 `astro.config.mjs` 中的站点 URL 配置正确
