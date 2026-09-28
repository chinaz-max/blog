# 浏览量与点赞

全站总浏览量位于页脚；每篇文章正文末尾显示本文浏览量、点赞总数和点赞按钮。

浏览量采用[不蒜子原版](https://busuanzi.ibruce.info/)，点赞采用 [Applause 项目推荐的社区后端](https://github.com/ColinEberhardt/applause-button)，地址为 `https://applause.chabouis.fr`。原 `api.applause-button.com` 服务已停止，不使用它。无需 API 密钥或额外账号，计数由这两个外部服务保存和共享，其可用性与数据留存由服务运营者决定。

统计是接入后的页面访问次数（PV），不是独立访客人数，无法补回接入前没有记录的访问。打开首页、归档和文章页都会计入全站浏览量；每篇文章只在实际打开时计数，预加载和阅读目录跳转不会增加浏览量。不自动重试浏览计数请求，以免网络超时后重复计数。

本地和预览域名使用明确标注的演示数据，不向线上提交浏览量或点赞。只有 `Astro.site` 对应的正式 HTTPS 来源才启用真实统计。开发环境可点击体验点赞；演示状态仅保留在当前页面会话。

点赞按钮在服务器确认后才更新总数。已确认的点赞在当前浏览器保存标记，防止刷新后重复点赞，支持跨标签同步；浏览器的 Web Locks 可用时，会串行处理同一文章的提交。浏览器本地仅保存已点赞标记，总数来自共享后端。匿名计数不能保证一人一票，清除浏览器数据或更换浏览器不受本地标记限制。提交失败不自动重发。

不蒜子依赖请求的 Referer 区分页面：仅该统计请求使用 `no-referrer-when-downgrade`，将当前公开页面 URL 发给统计服务。点赞请求传递规范化后的文章 URL，并只发送来源域名作为 Referer。两者都能在正常网络请求中接收访问者 IP；本站不额外发送 QQ、微信或其他账号信息。

外部服务失败时显示“—”与不可用提示，不把错误伪装为零。页面通过 Swup 切换时重新统计；重复生命周期通知不会重复计数，旧请求不会把上一篇文章的浏览数写入新页面。

相关文件：

- `src/components/engagement/EngagementTracker.astro`：接口、导航计数与点赞状态。
- `src/components/engagement/SiteViews.astro`、`PostEngagement.astro`：页面显示。
- `src/utils/engagement.ts`：稳定文章标识和响应校验。

验证命令（Node 22.6+）：`node --experimental-strip-types --test scripts/engagement.test.mjs`。

2026-09-28 本地验证：4 项计数与 URL 测试通过，Astro 构建及 Pagefind 索引生成通过；桌面与手机布局无横向溢出，点赞后显示“已点赞”，切换至其他文章显示独立计数，返回后保留点赞状态。使用独立测试 URL 验证了外部计数接口，未增加正式文章的数据。`astro check` 仍有项目原有的 Navbar 与 archive 两处类型错误，本次文件没有新增类型错误。
