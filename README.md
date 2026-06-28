 # Chowda Blog (初めのBlog)
 
 [![Node.js >= 20](https://img.shields.io/badge/node.js-%3E%3D20-brightgreen)](https://nodejs.org)
 [![pnpm >= 9](https://img.shields.io/badge/pnpm-%3E%3D9-blue)](https://pnpm.io)
 [![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-FF5D01?logo=astro)](https://astro.build)
 [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
 
 > 基于 [Fuwari](https://github.com/saicaca/fuwari) 的中文技术博客模板，预配置中文环境、GitHub Pages 部署、自定义域名与 SSL 支持，开箱即用。
 
 **在线地址**: [ctfer.cn](https://ctfer.cn)
 
 ---
 
 ## 特性
 
 - 基于 [Astro](https://astro.build) + [Tailwind CSS](https://tailwindcss.com) 构建，纯静态站点，加载极速
 - 中文优先配置：中文界面、中文 i18n 翻译、中文字体优化
 - 开箱即用的 GitHub Pages 部署 + 自定义域名 (ctfer.cn) + 自动 SSL
 - 暗色/亮色主题切换，可自定义主题色
 - 全文搜索（基于 Pagefind）
 - LaTeX 数学公式支持（KaTeX）
 - 代码高亮与 Expressive Code 增强（行号、折叠、复制按钮、语言徽标）
 - RSS / Sitemap / SEO 优化
 - 响应式设计，桌面端和移动端体验良好
 - 平滑页面切换动画（SWUP）
 - 文章目录、标签分类、归档页
 
 ## 快速开始
 
 ### 克隆并安装
 
 ```bash
 git clone https://github.com/chinaz-max/blog.git
 cd blog
 pnpm install
 ```
 
 > 需要 [pnpm](https://pnpm.io/installation) `>= 9`，如未安装：`npm install -g pnpm`
 
 ### 配置个人信息
 
 编辑 [`src/config.ts`](src/config.ts) 修改站点标题、副标题、头像、社交链接等。
 
 | 配置项 | 说明 |
 |:-------|:-----|
 | `siteConfig.title` | 博客标题 |
 | `siteConfig.subtitle` | 博客副标题 |
 | `profileConfig.avatar` | 头像图片路径 |
 | `profileConfig.links` | 社交链接 |
 | `navBarConfig.links` | 导航栏链接 |
 
 ### 创建文章
 
 ```bash
 pnpm new-post <文章文件名>
 ```
 
 编辑生成的 Markdown 文件，支持 Frontmatter：
 
 ```yaml
 ---
 title: 我的第一篇文章
 published: 2026-06-28
 description: 文章摘要
 image: ./cover.jpg
 tags: [技术, AI]
 category: 随笔
 draft: false
 ---
 ```
 
 ### 本地预览
 
 ```bash
 pnpm dev
 ```
 
 打开 `http://localhost:4321`
 
 ### 构建和部署
 
 ```bash
 pnpm build     # 输出到 dist/
 pnpm preview   # 本地预览构建结果
 ```
 
 项目已配置 [GitHub Pages 自动部署](.github/workflows/deploy.yml)，推送 `main` 分支即可自动构建并发布。
 
 ## 命令参考
 
 | 命令 | 作用 |
 |:-----|:-----|
 | `pnpm dev` | 启动本地开发服务器 (localhost:4321) |
 | `pnpm build` | 构建生产版本到 `dist/` |
 | `pnpm preview` | 预览构建结果 |
 | `pnpm check` | 代码检查 |
 | `pnpm format` | 使用 Biome 格式化代码 |
 | `pnpm new-post <filename>` | 创建新文章 |
 | `pnpm astro ...` | 运行 Astro CLI 命令 |
 
 ## 项目结构
 
 ```
 .
 ├── src/
 │   ├── config.ts              # 站点配置文件
 │   ├── content/
 │   │   ├── posts/             # 文章目录
 │   │   └── spec/              # 关于页面
 │   ├── components/            # UI 组件
 │   ├── layouts/               # 页面布局
 │   ├── pages/                 # 路由页面
 │   ├── plugins/               # 自定义插件
 │   ├── styles/                # 样式文件
 │   ├── i18n/                  # 国际化翻译
 │   ├── types/                 # TypeScript 类型
 │   └── utils/                 # 工具函数
 ├── public/                    # 静态资源
 ├── astro.config.mjs           # Astro 配置
 └── package.json
 ```
 
 ## 部署指南
 
 支持部署到任意静态托管平台：
 
 | 平台 | 说明 |
 |:-----|:-----|
 | **GitHub Pages** | 已预配置 Workflow，推送 main 自动部署 ([workflow](.github/workflows/deploy.yml)) |
 | **Vercel** | 连接仓库，框架选择 Astro 即可 |
 | **Netlify** | 连接仓库，构建命令 `pnpm build`，输出目录 `dist` |
 | **Cloudflare Pages** | 连接仓库，构建命令 `pnpm build`，输出目录 `dist` |
 
 ## 技术栈
 
 - **框架**: [Astro 5](https://astro.build)
 - **UI**: [Tailwind CSS 3](https://tailwindcss.com) + [Svelte 5](https://svelte.dev)
 - **图标**: [Iconify](https://iconify.design) (Font Awesome, Material Symbols)
 - **代码高亮**: [Expressive Code](https://expressive-code.com)
 - **搜索**: [Pagefind](https://pagefind.app)
 - **数学公式**: [KaTeX](https://katex.org)
 - **动画**: [SWUP](https://swup.js.org)
 - **字体**: JetBrains Mono Variable + Roboto
 
 ## 鸣谢
 
 本项目基于 [saicaca/fuwari](https://github.com/saicaca/fuwari) 构建，感谢原作者的出色工作。
 
 ## 贡献
 
 欢迎提交 Issue 和 Pull Request！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。
 
 ## 许可
 
 MIT License。详见 [LICENSE](LICENSE)。
 
 上游 [Fuwari](https://github.com/saicaca/fuwari) 同样使用 MIT License。
