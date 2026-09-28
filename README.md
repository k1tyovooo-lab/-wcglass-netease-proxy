# WCGlass 网易云音乐中转服务

这是给 WCGlass HTML 功能卡片用的只读中转服务。

## 能力

- `/health`
- `/api/playlist?id=歌单ID`
  - 返回歌单名称、歌单封面、完整歌曲列表
  - 每首歌包含：歌曲 ID、歌名、歌手、歌手 ID、专辑、专辑 ID、封面、时长、播放外链
- `/api/song?id=歌曲ID`
  - 返回单曲详细信息
- `/api/lyric?id=歌曲ID`
  - 返回原文歌词、翻译歌词、罗马音（网易云有则返回）

## 为什么需要中转

WCGlass 卡片运行在 WKWebView。直接从网页请求网易云会遇到 CORS、Referer / User-Agent 和 HTTPS 策略。
这个服务在服务器端请求网易云，再用 CORS 允许卡片访问。

## 运行

需要 Node.js 18+：

```bash
npm start
```

默认端口：8787，也可通过 `PORT` 环境变量修改。

测试：

```text
http://你的服务器:8787/health
http://你的服务器:8787/api/playlist?id=2017468493
```

## 部署建议

把整个目录部署到任何能长期运行 Node.js 18+ 的服务器/平台即可。
正式使用建议绑定 HTTPS 域名，例如：

```text
https://music-api.example.com
```

然后把这个地址填进 WCGlass 卡片设置里的“音乐接口地址”。

## 说明

- 这是只读接口，不需要网易云账号 Cookie。
- 网易云官方内部接口可能改变，因此后续如果接口变化，只需要修改服务器这一处，所有卡片无需重新改逻辑。
- 某些歌曲因版权、VIP、地区限制，播放外链仍可能不可播放；歌曲元数据和歌词不一定受相同限制。
