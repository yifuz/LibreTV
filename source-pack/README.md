# LibreTV 数据源迁移包

整理日期：2026-10-21（Asia/Shanghai）。兼容格式按本机 LibreTV 2.19.7 核对。把整个 source-pack 文件夹复制到其他设备即可保留清单、模板和验证记录；它不包含程序本身、当前登录密码、会话、观看历史或个人浏览器设置。

## 先选哪一份

| 用途 | 点播接口 | 直播列表 | 文件 |
| --- | --- | --- | --- |
| 原部署基础配置 | 5 | 1 | sources-default.json（Node.js 初始化用） |
| 推荐起步 | 8 | 1 | LibreTV-Settings-recommended.json / sources-recommended.json |
| 扩展备用 | 20 | 4 | LibreTV-Settings-full.json / sources-full.json |
| 电影样本验证 | 20 | 0 | LibreTV-Settings-movies.json / sources-movies.json |
| 电视剧样本验证 | 15 | 0 | LibreTV-Settings-tv.json / sources-tv.json |
| 综艺样本验证 | 11 | 0 | LibreTV-Settings-variety.json / sources-variety.json |
| 动漫优先 | 20 | 0 | LibreTV-Settings-anime.json / sources-anime.json |
| 仅直播列表 | 0 | 4 | sources-live.json |

四类清单表示对应固定关键词通过类型匹配；综合源可出现在多份清单中，分类数量不能相加为独立源数量，也不表示该源只提供这一类内容。

从 `yifuz/LibreTV` 私有仓库克隆后，运行 `npm run setup:local` 即可生成每台设备自己的密码并预置 `default` 清单，无需导入补丁。`recommended` 是另一份 8 个点播源的起步清单。

推荐起步包含：魔都动漫、暴风资源、非凡资源、量子影视、新浪资源、极速资源、电影天堂、最大资源。动漫优先包含：电影天堂、量子影视、猫眼资源、360 资源、极速资源、魔都资源、非凡资源、暴风资源、新浪资源、最大资源、无尽影视、豪华资源、速播资源、金鹰点播、U酷影视、飘零资源、红牛资源、光速资源、魔都动漫、金鹰资源（标准接口）。所有可导入点播接口均通过本次样本解码。直播中，动画列表只验证到列表可读，本轮抽测未找到能通过分片检查的样本，不能声称该列表可播。

## 方法一：新设备在浏览器中导入

1. 先在目标设备部署并启动 LibreTV，使用该设备自己的访问密码登录。
2. 进入“设置 → 数据 → 配置导入导出 → 导入配置”。
3. 选择 LibreTV-Settings-recommended.json；电影、电视剧、综艺和动漫分类分别可选 movies、tv、variety、anime 对应的 Settings 文件。
4. 核对应用显示的源数量后导入。已有设备的源和偏好会被替换，先使用应用内“导出配置”保留原配置；本包没有观看历史数据。

LibreTV-Settings-*.json 是浏览器配置导入文件；sources-*.json 是 SourceList 订阅格式，两者用途不同。不要把 sources-*.json 直接交给“导入配置”。Settings 导入只影响当前浏览器，不会自动为其他浏览器下发源。

## 方法二：为新的 Node.js 部署预置源

安装 Node.js 22 后，将本文件夹复制到新部署附近，在终端运行；把路径改为实际 LibreTV 源码目录：

```powershell
node ./source-pack/apply-sources.mjs "C:/path/to/LibreTV" recommended --dry-run
node ./source-pack/apply-sources.mjs "C:/path/to/LibreTV" recommended
```

Linux / macOS 示例：

```sh
node ./source-pack/apply-sources.mjs /path/to/LibreTV recommended
```

脚本只更新 DEFAULT_SOURCES / DEFAULT_LIVE_SOURCES，保留密码及其他环境变量；已有环境文件会先备份为 .env.sources-backup.<时间>.local。默认写入 .env.local，可把 recommended 改成 default、full、movies、tv、variety 或 anime。完成后重启目标 LibreTV。首次部署可先运行主仓库的 `npm run setup:local` 生成独立密码；本包不会复制这台电脑的密码。

## 方法三：Docker / NAS 部署模板

将 docker-compose.example.yml 复制为目标目录的 compose.yml，同时复制 .env.sources。在目标目录创建 .env 并自行设置 PASSWORD，然后运行：

```sh
docker compose pull
docker compose up -d
```

模板用 env_file 把 .env.sources 注入容器；只把 DEFAULT_SOURCES 写进宿主机 .env 而没有在 Compose 中传递，不会自动进入容器。模板默认发布主机 8080 端口。当前电脑未安装 Docker，因此模板未在本机启动容器验证。

## 方法四：作为远程订阅复用

把 sources-recommended.json 或 sources-full.json 托管到你控制的公网 HTTPS 静态地址。在目标 LibreTV 的“设置 → 源管理 → 数据源订阅”填该文件的直达 URL。需要返回 JSON 本文；GitHub 网页预览链接不等于原始 JSON。

这些文件随私有仓库保存，没有生成公开订阅地址。私有 GitHub 仓库的原始文件链接不能当作匿名公网订阅直接使用。LibreTV 的订阅拉取拒绝回环和内网地址，不能用 file:// 或 localhost 的文件路径作为订阅 URL。

## 复用本次豆瓣首页定制

从本私有仓库克隆时，代码已经包含首页定制，跳过下面的补丁应用步骤。补丁仅供同版本、未经本次定制的官方源码使用。

包内 `homepage-douban.patch` 保存了本机新增的电影、电视剧、综艺、动漫四区首页，包含每区 24 条分页、加载更多、热门 / 最新 / 高分排序及地区 / 题材 / 年份筛选。年份默认不限，可逐年选择 2000 年至当年，或选择 1990–1999、1980–1989、1970–1979、1900–1969 范围；年份可与其他筛选组合，不同条件使用独立分页。这个布局需要修改程序代码，单独导入源配置不会改变首页布局。

排序规则已更新：热门使用豆瓣近期热度（`U`）；最新保留首映 / 首播时间（`R`）顺序，并按实际评价人数过滤，只保留至少 500 人评价的条目，不设最低评分；高分保持原有 `S` 排序。未出分或评价不足的新作可能暂时不显示。过滤后会继续补足每批 24 条；单次扫描达到上限但还存在候选时，可“加载更多”或“继续查找”。

热门 / 最新缓存 6 小时，高分缓存 24 小时，浏览器查询缓存与服务器最终页面、底层列表 / 人数缓存使用相同时长。有效期内同条件、同分页优先复用；过期后按需更新，没有定时轮询。当前缓存仍存于内存，网页刷新会清除浏览器查询缓存，程序重启会清除服务器缓存；全新筛选条件或分页可能产生新请求。

补丁基于官方 LibreTV `2.19.7`，提交 `9d86ec2568895b2a8b52da47fc9bfea6c74f8378`。在同版本源码目录中，将本文件夹放在项目下，再执行：

```sh
git apply --check source-pack/homepage-douban.patch
git apply source-pack/homepage-douban.patch
npm ci
npm run build
```

确认每条命令成功后再继续，完成后按目标部署的方式重启。`git apply --check` 若提示冲突，表示目标代码与补丁不匹配，不要重复强行应用。已应用当前补丁的目录无需再次应用；已应用旧版首页补丁的设备，需要合并新版差异，不能直接叠加整份补丁。Docker 要以打过补丁的源码重新构建；官方预构建镜像不会包含这份本地首页定制。

本次缓存延长通过 32 项推荐相关测试和生产构建，使用本地模拟请求与模拟时间验证缓存命中及到期失效，未新增豆瓣外部请求。此前排序调整版通过全部 504 项测试，实测四区热门各取前两批 24 条无重复，电影 / 电视剧最新前两批均满足 500 人评价门槛；随后豆瓣触发异常请求 / 要求登录限制，其余最新分区和人数过滤的组合条件未完成真实接口实测。四区及年份筛选在此前版本通过过分页与组合检查。没有浏览器或电视端交互实测。

遇到豆瓣明确的访问限制或 HTTP 429 时，程序会冷却新请求 5 分钟，已有缓存仍可读取；冷却结束不保证豆瓣已解除限制。页面会提示具体错误并提供手动重试。

## 以后怎么复查

在 LibreTV 内使用“设置 → 源管理 → ⚡ 测活”；直播页也可测活并筛选频道。其他设备装有 Node.js 时，还可运行：

```sh
node ./source-pack/check-sources.mjs recommended
```

这个便携脚本只查搜索接口，另写一份时间戳报告，不验证视频播放，也不会自动修改清单。完整检测范围、各源状态和错误见 [VALIDATION.md](VALIDATION.md)、[catalog.csv](catalog.csv) 与 [validation-report.json](validation-report.json)。

本包是 2026-10-21 的可用性快照；换网络、时段、设备或源站更新后，结果可能变化。
