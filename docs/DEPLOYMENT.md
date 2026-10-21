# 跨设备部署说明

## 拉取与初始化

需要 Node.js 22 和 Git；Windows 启停脚本支持 PowerShell 7，也会回退到系统自带的 Windows PowerShell。私有仓库应先使用 GitHub CLI、Git Credential Manager 或 SSH 完成 GitHub 登录。

```sh
git clone https://github.com/yifuz/LibreTV.git
cd LibreTV
npm ci --no-fund --no-audit
npm run setup:local
```

`setup:local` 创建 `.env.local`，包含随机 `PASSWORD`、独立 `PROXY_SECRET`、豆瓣默认推荐以及 5 个点播源 / 1 个直播列表。只写入不存在的新文件；已有配置原样保留。密码请在部署设备直接查看，不要提交到 Git。

首次初始化也可指定清单，例如：

```sh
npm run setup:local -- recommended
```

可选 `default`、`recommended`、`full`、`movies`、`tv`、`variety`、`anime`、`live`。若已有 `.env.local`，修改源使用下方的独立导入脚本，初始化脚本不会覆盖它。

## Node.js 运行

```sh
npm run build
npm start
```

访问 http://localhost:8080，使用 `.env.local` 的 `PASSWORD` 登录。在终端前台运行时，按 Ctrl+C 停止。

Windows 希望后台运行时，构建后双击项目根目录的 `Start-LibreTV.cmd`，停止使用 `Stop-LibreTV.cmd`。后台脚本默认仅监听 `127.0.0.1:8080`，可查询状态：

```powershell
pwsh -NoProfile -File ./scripts/manage.ps1 -Action status
```

`.local/server.json`、`server.log` 和 `server-error.log` 是本机运行状态与日志，不上传仓库。关掉浏览器不会停止后台服务，重启系统后需要重新启动程序。

## 同一 Wi-Fi 下的电视访问

先停止已运行的服务，再以前台方式开放局域网监听：

```sh
npm run start -- --hostname 0.0.0.0
```

电视打开 `http://电脑的局域网IP:8080`，例如 `http://192.168.1.100:8080`。电脑应保持开机，Windows 防火墙允许专用网络访问该端口，Wi-Fi 路由器没有开启客户端隔离。电视端需要支持本站页面和视频格式的浏览器。

电视中的 `localhost` 指向电视本身。跨设备访问请使用电脑 IP；部署到公网时使用 HTTPS 和反向代理。

## Docker / NAS

先运行配置初始化，或将 `.env.example` 复制为 `.env.local` 并设置自己的强密码。推荐用初始化脚本自动生成独立密钥和默认源：

```sh
node scripts/setup-local.mjs
docker compose up -d --build
docker compose ps
```

Compose 使用 `.env.local` 注入运行环境，并构建当前仓库源码。访问 `http://部署主机IP:8080`。当前电脑没有 Docker，本机未验证容器启动；Node.js 生产构建已经验证。

停止容器：

```sh
docker compose down
```

配置变更后重新运行 `docker compose up -d --build`。不要用官方镜像替代当前源码构建，否则四区首页及其筛选 / 缓存改动不会带过去。

## 变更数据源

公开源清单位于 `source-pack/`，不包含本机密码或观看记录。例如先预览扩展清单，再应用：

```sh
node source-pack/apply-sources.mjs . full --dry-run
node source-pack/apply-sources.mjs . full
```

脚本保留密码和其他设置，对已有环境文件创建 `.env.sources-backup.<时间>.local` 备份。完成后重启服务。`default` 对应原部署的 5 个点播源和 1 个直播列表，`recommended` 为 8 个点播源和 1 个直播列表；其余清单见 [迁移包说明](../source-pack/README.md)。

## 更新与备份

Windows 后台服务先运行停止脚本，前台服务按 Ctrl+C。保留 `.env.local`，并在应用“设置 → 数据”导出个人浏览器配置，然后逐条执行：

```sh
git pull --ff-only
npm ci --no-fund --no-audit
npm run build
```

成功后按原方式启动。Docker 更新则在拉取后运行 `docker compose up -d --build`。

观看记录与个人设置属于浏览器本地数据，克隆 Git 仓库不会迁移它们；需要应用内导出 / 导入。榜单缓存仍为内存缓存，服务重启后重新按需获取，尚未添加持久化缓存或全局限速。

本机开发保留 `upstream` 指向官方 LibreTV；常规跨设备更新只从自己的 `origin/main` 拉取。合并上游升级需要单独检查差异，不要直接覆盖本仓库定制。
