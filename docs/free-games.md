# 首页游戏喜加一

右侧原 AI/Tibo 动态栏整体替换为游戏喜加一，分为 Epic 免费游戏和 Steam 喜加一，保留主页文章列宽、宽屏侧栏、窄屏折叠和深色主题。旧 AI 代码保留在仓库供回退，首页不再加载它或发送 AI/翻译接口请求。

## 数据与筛选

- Epic：官方 `freeGamesPromotions`，请求 `locale=zh-CN&country=CN&allowCountries=CN`。只收录基础游戏/游戏套装、有起止时间且免费促销字段为 0 的活动。当前活动还要求实时价格为 0、原价大于 0。过滤长期免费游戏、DLC 和普通折扣。预告到时间后显示“待核对”，直至下一次抓取确认免费价格，不直接把预告变成“可领取”。冬促连送与每周赠送通过同一官方源更新，不预测尚未公布的游戏或日期。
- Steam：[GamerPower 免费 API](https://www.gamerpower.com/api-read)，筛选 `platform=steam&type=game`。仅展示 Active 完整游戏；排除试玩周末、beta、demo、DLC 和 free-to-play。第三方 Key 以“Key 赠送 / 查看领取条件”展示，保留来源领取说明，不冒充 Steam 商店直接入库。
- 每个来源单独保存 `fetchedAt`。失败不重写它的原始时间；成功返回空列表会清除旧活动。活动截止后自动移出。缓存超过 2 小时显示“待核对”，超过 24 小时隐藏游戏卡片，保留来源入口。
- 只有带时区的日期才转换成北京时间。Steam 来源没有时区或未公布截止时，页面引导用户查看活动页，不猜测时区或剩余名额。
- 标题和领取说明均作纯文本渲染。商店/来源链接与封面域名经过校验，不加载任意 URL。

## 更新和部署

`node scripts/update-free-games.mjs` 从两个免费接口抓取并原子写入 `public/data/free-games.json`。`pnpm build` 在构建前运行它，无需 Python、密钥或订阅。GitHub Pages 现有部署工作流增加 UTC 每小时 07 和 37 分定时运行；每次重新抓取后构建发布。GitHub 调度、构建和 CDN 都可能有延迟，页面不承诺秒级数据。无需电脑保持开机。

浏览器每 5 分钟检查本站 JSON，无跨域依赖；每 30 秒重新计算活动是否结束。手动刷新至少间隔 1 分钟。页面隐藏时停止新轮询；离开首页清除计时器并取消未完成请求。浏览器缓存失效或网络失败不阻断博客文章。

## 文件和验证

- `src/components/widget/GameGiveaways.astro`：卡片、状态和轮询。
- `src/utils/free-games.js`：构建和浏览器共用的筛选、时间、链接校验。
- `scripts/update-free-games.mjs`：免费源抓取和快照写入。
- `scripts/free-games.test.mjs`：活动筛选、过期、预告、故障、时区和集成测试。

```text
node --test scripts/free-games.test.mjs
pnpm build
```

未公布的冬促内容不填充假数据。实际能否领取以账号所在地区、商店页面、第三方任务和剩余名额为准。
