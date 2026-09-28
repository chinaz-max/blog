# 首页 AI 动态栏

首页第一屏在视口宽度达到 1760px 时，把动态栏放在原内容区右侧，不改变文章列宽。较窄屏幕显示为文章上方的折叠栏。文章页不显示此组件。

数据来源：

- 重置状态与近 28 天公告：[Codex Resets 公共 API](https://codex-resets.com/api/docs)。页面已提供来源署名和链接，参考 [Tibo 重置助手](https://codex-reset.top/) 的内容组织。
- 工具稳定版：[OpenAI Codex](https://github.com/openai/codex/releases)、[Anthropic Claude Code](https://github.com/anthropics/claude-code/releases) 的官方 GitHub Releases。

页面可见时每 5 分钟检查重置动态，每 30 分钟检查版本信息。浏览器直接读取允许跨域访问的公开接口，不需要密钥。手动刷新至少间隔一分钟；切换离开首页时停止轮询并取消未完成的请求。

每个来源单独保存获取时间。来源失效时保留已有数据，并显示未更新提示。重置响应的获取时间或上游生成时间超过 20 分钟，就不再展示预测；观察窗口到期后也不显示旧预测。日历按北京时间统计公告日期，区分常规重置和备用额度，不能用于判断个人账户是否获得额度。观察窗口的截止时间不是承诺的重置时间。

`public/data/ai-radar.json` 是首次加载使用的公开数据快照。`pnpm build` 会先运行 `scripts/refresh-ai-radar.mjs`，自动选择本机的 Python 执行 `scripts/update-ai-radar.py` 更新它；接口暂不可用时保留原始时间，未安装 Python 时使用现有快照继续构建。现有部署工作流无需修改。此步骤不创建定时任务，页面打开后的实时更新由浏览器完成。

维护位置：

- `src/components/widget/AIRadar.astro`：显示、轮询、缓存和手机适配。
- `src/utils/ai-radar.ts`：数据校验、预测有效期和北京时间日历。
- `scripts/ai-radar.test.mjs`：过期预测、上游旧缓存、预告到期、跨日期公告和不安全链接的检查。

本地验证命令（Node 22.6+）：`node --experimental-strip-types --test scripts/ai-radar.test.mjs`。正常构建使用原项目的 `pnpm build`。

本次预览验证：新增的 5 项逻辑测试、静态构建及搜索索引通过；检查了 1920、1760、1440 和 390 像素宽度，手机展开、明暗主题、进入文章再返回首页均正常。全项目 `astro check` 仍报告已有的 `Navbar.astro` Svelte 属性类型和 `archive.astro` 分类可空类型两处问题，此功能未修改这两处文件。
