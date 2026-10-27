# 数据源验证记录

本文件保留 2026-10-21 的综合源样本检查。本次 2026-10-27 新增的 4K 检查见 [VALIDATION-4K.md](VALIDATION-4K.md)，未重新检查全部综合源。

测试时间：2026-10-21 11:12:02 Asia/Shanghai。LibreTV 2.19.7。这是一次样本检查，不是长期可用率统计。

检查 37 个点播接口，其中 20 个通过样本解码，17 个未进入可用迁移清单；相对本机原有 5 个源，新增 15 个通过样本解码的接口。另检查 4 个直播列表。不同地址可能属于同一家源站，不能把接口数量视为独立供应方数量。

## 检查方法

点播分别搜索“葬送的芙莉莲”“凡人修仙传”“流浪地球”，使用 LibreTV 本机 API 获取详情，并通过应用代理解码 2 秒视频和可用音轨。采用固定关键词，匹配不到不代表整站无内容。测试通过只覆盖所选样本；未验证完整剧集、连续多天、其他网络及电视浏览器。

直播检查列表解析，并从每个列表抽取至多 5 个频道做分片探测；有通过的样本再尝试解码 2 秒。频道数量随列表更新变化，不能把“列表可读”当作“全部频道可播”。

## 点播接口

| 名称 | 状态 | 日漫结果 | 国漫结果 | 电影结果 | 样本集数 | 地址 |
| --- | --- | --- | --- | --- | --- | --- |
| 卧龙资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://wolongzyw.com/api.php/provide/vod |
| 天涯影视 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://tyyszy.com/api.php/provide/vod |
| iKun资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://ikunzyapi.com/api.php/provide/vod |
| 豆瓣资源 | 格式可读，测试关键词无结果 | 0 | 0 | 0 |  | https://caiji.dbzy5.com/api.php/provide/vod |
| 茅台资源 | 格式可读，测试关键词无结果 | 0 | 0 | 0 |  | https://caiji.maotaizy.cc/api.php/provide/vod |
| 电影天堂 | 样本解码通过 | 3 | 2 | 4 | 28 | http://caiji.dyttzyapi.com/api.php/provide/vod |
| 量子资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://cj.lzcaiji.com/api.php/provide/vod |
| 量子影视 | 样本解码通过 | 3 | 12 | 7 | 28 | https://cj.lziapi.com/api.php/provide/vod |
| 卧龙影视 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://collect.wolongzyw.com/api.php/provide/vod |
| 猫眼资源 | 样本解码通过 | 3 | 2 | 3 | 42 | https://api.maoyanapi.top/api.php/provide/vod |
| 优质资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://api.yzzy-api.com/inc/apijson.php |
| 360 资源 | 样本解码通过 | 2 | 11 | 3 | 28 | https://360zy.com/api.php/provide/vod |
| 极速资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://jszyapi.com/api.php/provide/vod |
| 魔都资源 | 样本解码通过 | 2 | 10 | 4 | 28 | https://www.mdzyapi.com/api.php/provide/vod |
| 最大点播 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://zuidazy.me/api.php/provide/vod |
| 无尽资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://api.wujinapi.me/api.php/provide/vod |
| 非凡资源 | 样本解码通过 | 2 | 3 | 4 | 28 | https://api.ffzyapi.com/api.php/provide/vod |
| 暴风资源 | 样本解码通过 | 2 | 5 | 7 | 28 | https://bfzyapi.com/api.php/provide/vod |
| 旺旺短剧 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://wwzy.tv/api.php/provide/vod |
| 新浪资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://api.xinlangapi.com/xinlangapi.php/provide/vod |
| 最大资源 | 样本解码通过 | 2 | 4 | 7 | 28 | https://api.zuidapi.com/api.php/provide/vod |
| 旺旺资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://api.wwzy.tv/api.php/provide/vod |
| 无尽影视 | 样本解码通过 | 2 | 4 | 5 | 28 | https://api.wujinapi.com/api.php/provide/vod |
| 金鹰资源 | 详情通过，解码未通过 | 2 | 5 | 5 | 28 | https://jyzyapi.com/provide/vod/from/jinyingyun/at/json |
| 豪华资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://hhzyapi.com/api.php/provide/vod |
| 速播资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://subocaiji.com/api.php/provide/vod |
| 金鹰点播 | 样本解码通过 | 2 | 5 | 5 | 28 | https://jinyingzy.com/api.php/provide/vod |
| U酷影视 | 样本解码通过 | 2 | 2 | 5 | 28 | https://api.ukuapi88.com/api.php/provide/vod |
| 飘零资源 | 样本解码通过 | 2 | 4 | 4 | 28 | https://p2100.net/api.php/provide/vod |
| 山海资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://zy.sh0o.cn/api.php/provide/vod |
| 红牛资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://www.hongniuzy2.com/api.php/provide/vod |
| 索尼资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://suoniapi.com/api.php/provide/vod |
| 樱花资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://m3u8.apiyhzy.com/api.php/provide/vod |
| 光速资源 | 样本解码通过 | 2 | 5 | 5 | 28 | https://api.guangsuapi.com/api.php/provide/vod |
| 快车资源 | 本次检查失败 | 0 | 未测试 | 未测试 |  | https://caiji.kuaichezy.org/api.php/provide/vod |
| 魔都动漫 | 样本解码通过 | 2 | 10 | 4 | 28 | https://caiji.moduapi.cc/api.php/provide/vod |
| 金鹰资源（标准接口） | 样本解码通过 | 2 | 5 | 5 | 28 | https://jyzyapi.com/api.php/provide/vod |

## 直播列表

| 名称 | 频道数 | 状态 | 解码样本 | 地址 |
| --- | --- | --- | --- | --- |
| iptv-org 中国频道 | 149 | 样本解码通过 | CCTV-1 (720p) | https://iptv-org.github.io/iptv/countries/cn.m3u |
| iptv-org 中文频道 | 218 | 样本解码通过 | CCTV-1 (720p) | https://iptv-org.github.io/iptv/languages/zho.m3u |
| iptv-org 动画频道 | 171 | 列表解析通过，未验证解码 | 本轮未找到通过的样本 | https://iptv-org.github.io/iptv/categories/animation.m3u |
| iptv-org 新闻频道 | 1016 | 样本解码通过 | Al Jazeera 2 (1080p) | https://iptv-org.github.io/iptv/categories/news.m3u |

## 证据与出处

完整逐项结果、时间、错误和媒体信息见 [validation-report.json](validation-report.json)，Excel 可打开 [catalog.csv](catalog.csv)。

- 候选发现：[社区源配置](https://github.com/Wolfun/luna-moon-tv-api/blob/main/jingjian.json)。只用于发现地址，未沿用其历史可用率宣称。
- 直播列表：[iptv-org PLAYLISTS](https://github.com/iptv-org/iptv/blob/master/PLAYLISTS.md)。
- 格式依据：[LibreTV 数据源文档](https://libretv.is-an.org/wiki/Data-Sources.html)。
- 各条目在 JSON / CSV 内另保留发现出处。源名称沿用站点或清单称呼，不代表同名影视平台的官方接口；本次检查未核验源站经营主体或内容授权。

## 电影、电视剧、综艺、动漫分类复核

复核时间：2026-10-21 11:19:19 Asia/Shanghai。固定关键词分别是“流浪地球”“庆余年”“你好星期六”“葬送的芙莉莲”。匹配数只计源站标记为相应内容类型的条目，排除电影解说、预告；电视剧清单排除短剧类型，避免同名短剧混入。零结果只表示本次固定关键词未通过，不能据此判断该站没有这一类作品。

| 名称 | 电影匹配 | 电视剧匹配 | 综艺匹配 | 动漫匹配 |
| --- | --- | --- | --- | --- |
| 电影天堂 | 3 | 3 | 1 | 3 |
| 量子影视 | 3 | 2 | 2 | 2 |
| 猫眼资源 | 3 | 1 | 1 | 3 |
| 360 资源 | 3 | 3 | 2 | 2 |
| 极速资源 | 3 | 0 | 0 | 2 |
| 魔都资源 | 3 | 2 | 1 | 2 |
| 非凡资源 | 3 | 4 | 1 | 2 |
| 暴风资源 | 3 | 4 | 1 | 2 |
| 新浪资源 | 3 | 3 | 0 | 2 |
| 最大资源 | 3 | 3 | 1 | 2 |
| 无尽影视 | 3 | 0 | 0 | 2 |
| 豪华资源 | 3 | 0 | 0 | 2 |
| 速播资源 | 3 | 3 | 0 | 2 |
| 金鹰点播 | 3 | 0 | 0 | 2 |
| U酷影视 | 5 | 3 | 1 | 2 |
| 飘零资源 | 3 | 3 | 1 | 2 |
| 红牛资源 | 3 | 3 | 0 | 2 |
| 光速资源 | 3 | 3 | 0 | 2 |
| 魔都动漫 | 3 | 2 | 1 | 2 |
| 金鹰资源（标准接口） | 3 | 0 | 0 | 2 |

以下每一类另选 3 个源，通过应用代理解码 2 秒的视频和可用音轨，共 12 组；这是分类样本验证，不代表每个接口的每一部作品都逐一验证。

| 类别 | 源 | 作品 | 集数 | 视频解码 | 帧数 |
| --- | --- | --- | --- | --- | --- |
| 电影 | 暴风资源 | 流浪地球 | 1 | 通过 | 45 |
| 电影 | 非凡资源 | 流浪地球 | 1 | 通过 | 45 |
| 电影 | 新浪资源 | 流浪地球 | 1 | 通过 | 47 |
| 综艺 | 暴风资源 | 你好星期六 | 511 | 通过 | 49 |
| 综艺 | 非凡资源 | 你好星期六 | 487 | 通过 | 49 |
| 综艺 | 量子影视 | 你好，星期六 | 548 | 通过 | 49 |
| 动漫 | 非凡资源 | 葬送的芙莉莲 | 28 | 通过 | 46 |
| 动漫 | 暴风资源 | 葬送的芙莉莲 | 28 | 通过 | 47 |
| 动漫 | 新浪资源 | 葬送的芙莉莲 | 28 | 通过 | 47 |
| 电视剧 | 非凡资源 | 庆余年第二季 | 36 | 通过 | 48 |
| 电视剧 | 暴风资源 | 庆余年 第一季 | 46 | 通过 | 49 |
| 电视剧 | 新浪资源 | 庆余年 第二季 | 36 | 通过 | 47 |

## 文件验证

所有 SourceList 文件已由 LibreTV 实际解析函数核对；所有 Settings 文件已通过当前 importConfig 函数在隔离存储环境中的导入检查。迁移脚本的预览、写入、凭证保留与备份已在模拟部署目录验证。包内逐文件扫描未发现本机密码、签名密钥或会话 Cookie。这些检查未操作用户浏览器，也不代表浏览器完整交互测试。
