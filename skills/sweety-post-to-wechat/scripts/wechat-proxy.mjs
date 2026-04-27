#!/usr/bin/env node
// 微信 API 转发代理服务器
// 用途：在拥有稳定固定 IP 的服务器上运行，将请求原封不动转发到微信官方 API
// 用法：node wechat-proxy.mjs [端口号]
// 默认端口：9100
// 然后在 EXTEND.md 中设置：base_url: http://你的服务器IP:9100

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const TARGET = "https://api.weixin.qq.com";
const PORT = parseInt(process.argv[2] || process.env.WECHAT_PROXY_PORT || "9100", 10);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", target: TARGET, uptime: process.uptime() }));
    return;
  }

  const target = new URL(req.url, TARGET);

  const options = {
    hostname: target.hostname,
    port: 443,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.hostname },
  };

  // 移除代理相关的 hop-by-hop 头
  delete options.headers["connection"];
  delete options.headers["keep-alive"];
  delete options.headers["transfer-encoding"];

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`[wechat-proxy] 转发失败: ${req.method} ${req.url} -> ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "proxy_error", message: err.message }));
    }
  });

  req.pipe(proxyReq);

  console.log(`[wechat-proxy] ${req.method} ${req.url} -> ${target.href}`);
});

server.listen(PORT, () => {
  console.log(`[wechat-proxy] 微信 API 转发代理已启动`);
  console.log(`[wechat-proxy] 监听端口: ${PORT}`);
  console.log(`[wechat-proxy] 目标地址: ${TARGET}`);
  console.log(`[wechat-proxy] 在 EXTEND.md 中配置: base_url: http://你的服务器IP:${PORT}`);
});
