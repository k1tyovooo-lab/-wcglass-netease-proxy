
const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 8787;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const REFERER = "https://music.163.com/";

function send(res, status, data, extraHeaders = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

async function ncmFetch(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Referer": REFERER,
      "Accept": "application/json,text/plain,*/*",
    },
    redirect: "follow",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`NetEase HTTP ${r.status}: ${text.slice(0,120)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`NetEase returned non-JSON: ${text.slice(0,120)}`); }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeSong(s) {
  const ar = s.ar || s.artists || s.song?.ar || s.song?.artists || [];
  const al = s.al || s.album || s.song?.al || s.song?.album || {};
  return {
    id: String(s.id ?? s.song?.id ?? ""),
    name: s.name ?? s.song?.name ?? "未知歌曲",
    singer: Array.isArray(ar) ? ar.map(x => x?.name || x).filter(Boolean).join("/") : "",
    artistIds: Array.isArray(ar) ? ar.map(x => x?.id).filter(Boolean) : [],
    album: al?.name || "",
    albumId: al?.id || null,
    cover: al?.picUrl || s.picUrl || "",
    duration: s.dt ?? s.duration ?? 0,
    streamUrl: s.id ? `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(s.id)}.mp3` : "",
  };
}

async function getSongDetails(ids) {
  const songs = [];
  for (const group of chunk(ids, 150)) {
    const idsJson = JSON.stringify(group.map(id => Number(id)));
    const url = `https://music.163.com/api/song/detail?ids=${encodeURIComponent(idsJson)}`;
    const d = await ncmFetch(url);
    const arr = d?.songs || d?.data?.songs || [];
    songs.push(...arr);
  }
  return songs;
}

async function getPlaylist(id) {
  const d = await ncmFetch(`https://music.163.com/api/v6/playlist/detail?id=${encodeURIComponent(id)}`);
  const p = d?.playlist;
  if (!p) throw new Error("playlist not found");

  const trackIds = (p.trackIds || []).map(x => x?.id).filter(Boolean);
  if (!trackIds.length) {
    const fallback = (p.tracks || []).map(normalizeSong);
    return {
      id: String(p.id || id),
      name: p.name || "歌单",
      cover: p.coverImgUrl || "",
      description: p.description || "",
      trackCount: p.trackCount || fallback.length,
      songs: fallback,
    };
  }

  const full = await getSongDetails(trackIds);
  return {
    id: String(p.id || id),
    name: p.name || "歌单",
    cover: p.coverImgUrl || "",
    description: p.description || "",
    trackCount: p.trackCount || trackIds.length,
    songs: full.map(normalizeSong),
  };
}

async function getLyric(id) {
  const d = await ncmFetch(
    `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=-1&kv=-1&tv=-1`
  );
  return {
    id: String(id),
    lyric: d?.lrc?.lyric || "",
    translatedLyric: d?.tlyric?.lyric || "",
    romajiLyric: d?.romalrc?.lyric || "",
    noLyric: !!d?.nolyric,
    uncollected: !!d?.uncollected,
  };
}

async function getSong(id) {
  const arr = await getSongDetails([id]);
  if (!arr.length) throw new Error("song not found");
  return normalizeSong(arr[0]);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const u = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (u.pathname === "/health") {
      return send(res, 200, { ok: true, service: "wcglass-netease-proxy" });
    }

    if (u.pathname === "/api/playlist") {
      const id = (u.searchParams.get("id") || "").match(/\d+/)?.[0];
      if (!id) return send(res, 400, { ok: false, error: "missing playlist id" });
      const data = await getPlaylist(id);
      return send(res, 200, { ok: true, data });
    }

    if (u.pathname === "/api/song") {
      const id = (u.searchParams.get("id") || "").match(/\d+/)?.[0];
      if (!id) return send(res, 400, { ok: false, error: "missing song id" });
      const data = await getSong(id);
      return send(res, 200, { ok: true, data });
    }

    if (u.pathname === "/api/lyric") {
      const id = (u.searchParams.get("id") || "").match(/\d+/)?.[0];
      if (!id) return send(res, 400, { ok: false, error: "missing song id" });
      const data = await getLyric(id);
      return send(res, 200, { ok: true, data });
    }

    return send(res, 404, {
      ok: false,
      error: "not found",
      endpoints: ["/health", "/api/playlist?id=", "/api/song?id=", "/api/lyric?id="],
    });
  } catch (err) {
    console.error(err);
    return send(res, 502, { ok: false, error: err?.message || String(err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WCGlass NetEase proxy listening on :${PORT}`);
});
