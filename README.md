# LibreTV 本地部署定制版

本仓库保存已经部署使用的 LibreTV 程序、四区豆瓣首页和数据源迁移材料，方便在其他电脑、NAS 或服务器重新部署。基于 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV) `2.19.7`，遵循原项目的 [AGPL-3.0](LICENSE) 许可。

## 新设备快速部署

先安装 Git 和 Node.js 22。若仓库设为私有，需要先登录具有访问权限的 GitHub 账号，例如执行 `gh auth login`、`gh auth setup-git`，或使用已授权的 SSH 密钥。

逐条运行，确认成功后再继续：

```sh
git clone https://github.com/yifuz/LibreTV.git
cd LibreTV
npm ci --no-fund --no-audit
npm run setup:local
npm run build
npm start
```

打开 **http://localhost:8080**。登录密码是新设备 `.env.local` 文件中的 `PASSWORD`；每台设备自动生成独立密码与签名密钥。脚本不会覆盖已有 `.env.local`。

Windows 构建完成后也可双击 `Start-LibreTV.cmd` 后台启动，双击 `Stop-LibreTV.cmd` 停止。运行状态和日志保存在被 Git 忽略的 `.local/`，启动脚本会自动定位新设备的 Node.js。

电视使用：双击 `Start-LibreTV-TV.cmd` 开启局域网监听，脚本会列出电视可输入的地址。电视与电脑连接同一路由器，在电视浏览器打开该地址并使用原密码登录。页面顶部“电视”按钮、设置中的“偏好设置 → 首页与内容 → 电视遥控模式”可切换遥控操作；地址追加 `?tv=1` 也可开启。

## 已包含的功能与配置

- 首页分为电影、电视剧、综艺、动漫四区，每区先显示 24 部，支持加载更多。
- 首区优先加载，其余分区接近屏幕时才请求；快速划过不会逐区触发请求。
- 支持地区、类型、年份筛选，默认使用豆瓣推荐。
- 同一标签页保留各分区筛选；站内返回复用已加载分页并恢复滚动位置和卡片焦点。
- 电视模式支持方向键选片、确定键操作、返回关闭弹窗及全屏；点播和直播均有可聚焦的播放／暂停、全屏按钮。
- 热门采用近期热度；最新按首映 / 首播排序并保留至少 500 人评价的作品；高分沿用豆瓣评分排序。
- 热门 / 最新缓存 6 小时，高分缓存 24 小时；缓存落盘，重启后复用，失败时提供额外保留最多 7 天的旧榜单。
- 相同推荐请求合并，豆瓣请求串行且起始间隔至少 1 秒；风控冷却 5 分钟并跨重启保留，没有定时轮询。
- 初始化默认配置与原部署一致：5 个点播源、1 个直播列表。另附推荐、扩展及电影 / 电视剧 / 综艺 / 动漫分类清单，见 [source-pack](source-pack/README.md)。

本仓库的首页定制已经直接合入代码，克隆后无需再应用 `homepage-douban.patch`。该补丁保留为 2026-10-21 的归档，不包含后续缓存落盘、请求限速和依赖修复；新设备应直接克隆本仓库。

## Docker / NAS

使用仓库中的 Dockerfile 和 Compose 文件，从本仓库源码构建；官方预构建镜像不含这份首页定制。

```sh
node scripts/setup-local.mjs
docker compose up -d --build
```

这组命令需要本机安装 Node.js 和 Docker Compose；运行容器后访问主机的 8080 端口。详细安装、环境变量、局域网访问和更新步骤见 [跨设备部署说明](docs/DEPLOYMENT.md)。

## 更新

停止当前服务后逐条执行：

```sh
git pull --ff-only
npm ci --no-fund --no-audit
npm run build
npm start
```

Windows 后台运行时，先双击停止脚本，更新后再双击启动脚本；Docker 使用 `docker compose up -d --build` 重建并启动。保留新设备自己的 `.env.local`。

## 验证与已知限制

测试使用本地模拟请求；构建与测试不会批量请求豆瓣来测活。豆瓣曾触发异常请求限制，部分排序和组合筛选未完成真实接口复查；程序会显示错误并冷却新请求 5 分钟。冷却不保证上游已解除限制。

数据源是 2026-10-21 的可用性快照，之后可能失效。观看历史、收藏和个人设置存于各设备浏览器，不会随 Git 同步。部署密码、代理密钥、`.local` 日志及本机环境文件均不入库。

上游完整功能文档见 [LibreTV 官方文档](https://libretv.is-an.org/wiki/)。本仓库新增的 GitHub Actions 运行测试、依赖安全检查和构建，原官方镜像发布流程在本仓库中跳过。
