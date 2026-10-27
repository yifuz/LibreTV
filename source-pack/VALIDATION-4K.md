# 4K 点播接口验证记录

检查日期：2026-10-27（Asia/Shanghai）。本次为 2026-10-21 综合源快照的增量检查，没有重新检测全部综合源。

## 可加入当前清单的接口

`sources-4k.json` 与 `LibreTV-Settings-4k.json` 只包含最大资源：

```text
https://api.zuidapi.com/api.php/provide/vod
```

- 使用当前 LibreTV 的 `ac=videolist`、`wd`、`pg` 参数搜索《攻壳机动队4K》，返回 1 个匹配条目；项目 CMS 解析器成功解析搜索与详情。
- 对应影片 ID 为 `117536`；HLS 清单与分片前缀中的编码尺寸均为 **3840×2074**，视频 H.264、音频 AAC。宽银幕画面的高度小于 2160。
- 最大资源已经存在于推荐和扩展清单中，本次为其新增 4K 用途与样片证据，没有把它计算为新的独立源站。
- `4k` 清单是含 4K 样片的综合接口清单，不是只返回 4K 影片的接口；仍需逐片检查画质。

## 其他候选

| 名称 | 公开接口 | 本机检查结果 | 是否加入 4k 清单 |
| --- | --- | --- | --- |
| 快车 | `https://caiji.kuaichezy.org/api.php/provide/vod` | 分类可读，《攻壳机动队4K》分片尺寸 3840×2074；按程序同款参数及请求头搜索返回“暂不支持搜索”。 | 否 |
| 闪电 | `https://sdzyapi.com/api.php/provide/vod` | 分类可读，《攻壳机动队4K》分片尺寸 3840×2074；搜索返回“暂不支持搜索”。 | 否 |
| 索尼 | `https://suoniapi.com/api.php/provide/vod` | 有 4K 分类，但搜索返回“暂不支持搜索”；所抽查两部带 4K 标签的影片实际为 1994×1080、1920×1036。 | 否 |

快车、最大、闪电的《攻壳机动队4K》最终指向相同的分片 URL，不能当作三个独立上游或独立备份。快车《怪物史瑞克2国语4K》为 2006×1080，闪电《无人知晓4K》为 1792×1080，说明片名及“4K电影”分类本身不能证明画质。

## 检查范围与限制

本次低频读取公开 JSON 接口；每部样片只读取少量 HLS 清单及最多 1 MiB 分片前缀，再由本地 `ffprobe` 解析编码尺寸。没有下载全片、连续播放或电视实机验收，也没有访问豆瓣推荐接口。

3840 像素宽的编码尺寸不能证明母版原生 4K、HDR、原盘码率、无广告或长期稳定性。其余未抽查影片、整集、其他网络与时段的状态未知。检测过程中未修改部署密码、浏览器数据源或运行服务。

机器可读结果、样片 ID、检查时间、公开播放地址和实测尺寸见 [validation-4k-report.json](validation-4k-report.json)。原综合检查保存在 [VALIDATION.md](VALIDATION.md) 与 [validation-report.json](validation-report.json)，其日期仍为 2026-10-21。

## 发现入口

- [快车资源接口说明](https://kuaichezy.com/)
- [最大资源公开 JSON 接口](https://api.zuidapi.com/api.php/provide/vod)
- [索尼资源公开 JSON 接口](https://suoniapi.com/api.php/provide/vod)
- [闪电资源公开 JSON 接口](https://sdzyapi.com/api.php/provide/vod)
- GitHub TVBOX 配置只用于发现候选地址；需要 Spider/JAR 引擎的条目未作为 LibreTV 可用源。
