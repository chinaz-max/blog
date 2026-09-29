# 首页 AI 动态栏

首页在视口宽度达到 1760px 时，把动态栏放在原内容区右侧，不改变文章列宽；较窄屏幕显示为文章上方的折叠栏。文章页不显示此组件。

## 完全免费的 Tibo 动态

原“近期 AI 工具更新”替换为 @thsottiaux 的近期 5 条帖子，包含回复，按发布时间排序。默认显示中文，支持切换 English 并记住选择。每条保留北京时间、原文链接；较长内容可展开。纯链接或表情原样保留，图片、视频和引用帖上下文请在 X 原帖查看。

- 帖子来自 [Will Codex Reset 的公开接口](https://willreset.com/developers)：`https://willreset.com/api/feed` 的 `posts` 字段。`events` 是社区整理的事件，不能充当帖子原文。接口无需密钥，允许跨域。仅接收作者路径为 `thsottiaux`、帖子 ID 匹配、时间有效的帖子，并去重。
- 中文来自 [MyMemory 免费翻译接口](https://mymemory.translated.net/doc/spec.php)，仅使用匿名 `/get`，无需账号、支付信息或 API key，不启用付费服务。中文标注为机器翻译，英文始终保留。
- [匿名免费额度](https://mymemory.translated.net/doc/usagelimits.php)为每天 5,000 字符，单次查询最多 500 UTF-8 字节。请求按 450 字节分段，保留链接、账号和段落。浏览器按 UTC 日期把自身用量限制在 4,500 字符内；服务端可能按来源 IP 共享额度，实际可用量也会受其他使用者影响。遇到配额或网络错误保留英文，至少 30 分钟后再尝试；本地预算耗尽则次日再试。
- 翻译按帖子 ID 及完整英文内容缓存，英文发生变化时不复用旧译文。只保存全部分段成功的译文，防止把部分翻译或接口报错当成中文正文。

## 更新方式与边界

页面可见时每 5 分钟直接检查重置和帖子接口；首次打开、回到页面以及手动刷新也会按有效期检查。手动刷新至少间隔一分钟。离开首页时取消未完成请求并清除轮询；页面隐藏时不发起新一轮检查或翻译。

社区来源在博客页面关闭后继续自行收录动态，访客再次打开首页时获取它当前提供的数据。博客没有另建常驻采集服务、付费后台、X API 订阅、Codex 自动任务或 GitHub 定时部署。上游采集不依赖这台电脑保持运行。

**这属于定时检查社区收录，不能保证秒级或覆盖全部 X 帖子。**“帖子检查于”表示本博客成功取得接口数据的时间，不代表社区刚完成对 X 的扫描。页面会说明社区来源可能延迟或不完整。来源报错、返回空列表或无效数据时保留上次内容和原始检查时间。

接入实测（2026-09-30 北京时间）：Will Codex Reset 返回 80 条近期帖子，取其中最新 5 条展示，包含 2026-09-29 发布的内容。另一个候选 RSSHub 实例当时返回的是 2025-11 的旧帖子，因此没有采用它。

## 重置观察与构建快照

重置状态与近 28 天公告来自 [Codex Resets 公共 API](https://codex-resets.com/api/docs)，保留来源署名；内容组织参考 [Tibo 重置助手](https://codex-reset.top/)。每个来源单独保存获取时间。重置响应的获取时间或上游生成时间超过 20 分钟，就不再展示预测；观察窗口到期也不显示旧预测。日历按北京时间统计公告日期，区分常规重置和备用额度，不能用于判断个人账户是否获得额度。

`public/data/ai-radar.json` 是首次加载的公开快照。`pnpm build` 先运行 `scripts/refresh-ai-radar.mjs`，选择 Python 执行 `scripts/update-ai-radar.py`，并用相同的免费接口为新帖子生成中文。已缓存且原文一致的译文不重复请求。抓取失败保留原始时间；翻译失败保留英文；未安装 Python 时用现有快照继续构建。快照原子写入，避免进程中断损坏旧数据。

## 维护和验证

- `src/components/widget/AIRadar.astro`：显示、轮询、语言选择、翻译预算和生命周期。
- `src/utils/ai-radar.ts`：重置校验、预测有效期和北京时间日历。
- `src/utils/tibo-feed.ts`：帖子校验、翻译缓存合并、分段和免费翻译请求。
- `scripts/tibo_feed.py`：构建时获取、校验和翻译帖子。

验证命令：

```text
node --experimental-strip-types --test scripts/ai-radar.test.mjs scripts/tibo-feed.test.mjs
python -m unittest discover -s scripts -p test_tibo_feed.py -v
pnpm build
```

Node 逻辑测试要求 22.6+；正式构建仍兼容当前部署的 Node 20 和 Python 3.10+。全项目 `astro check` 原有的 `Navbar.astro` Svelte 属性类型和 `archive.astro` 分类可空类型两处错误不属于此功能。

本次验证：11 项 Node 测试和 5 项 Python 测试通过，静态构建与搜索索引通过；浏览器验证了中文/英文切换、长帖展开、真实接口刷新、进入文章页隐藏组件以及返回首页恢复。1920px 侧栏和 390px 窄屏均无横向溢出。
