# Folia 结构化歌词

原 `type=lrc` 继续返回 LRC 文本，显式指定 `format=json` 才启用结构化歌词补充

```text
GET /api?server=netease&type=lrc&id=1974443814&format=json
GET /api?server=tencent&type=lrc&id=003OUlho2HcRHC&format=json
```

返回 `version`、`lyric`、`translation`、`romanization`、`wordLyric`、`wordFormat`、`source`，不透传账号凭据或原始上游数据

网易云使用 `/api/song/lyric/v1` 的 YRC，QQ 使用 `music.musichallSong.PlayLyricInfo.GetPlayLyricInfo` 的 QRC，酷狗使用 `lyrics.kugou.com` 的 KRC，平台逐字缺失时网易云、QQ 通过 AMLL 官方接口按平台 ID 查询 TTML

没有时间轴时保留原逐行歌词，不进行歌词时间插值，也不做跨音源的模糊歌曲匹配，失败会记录不含凭据的降级日志

网易云、QQ、酷狗的普通歌词请求失败时，仅显式结构化请求继续尝试逐字接口和已有回退链路，网易云 v1 返回的 `lrc.lyric` 也参与补全，原文本接口的错误行为不变

新增请求使用固定上游域名、5 秒超时、禁止重定向和 1 MiB 响应限制，QRC/KRC 解压输出限制为 1 MiB，结构化请求的歌曲 ID 限定为 1 至 256 个字母、数字、下划线或连字符

账号选取沿用原 API 的 Cookie 选择逻辑，不新增环境变量或管理配置，OpenMusic 端先请求结构化接口，旧客户端继续请求原文本接口

QRC 解密器源于 Folia `77640a4c9861df04ce1197944ce57e0ad7f56d66`，对应源码、AGPL-3.0 LICENSE 和修改说明保存在 `src/vendor/folia`，该派生文件不使用项目根目录的 MIT 许可重新标记

先升级本服务再升级 OpenMusic，回滚时可先回退 OpenMusic，原文本接口不受本功能开关影响，无持久化迁移
