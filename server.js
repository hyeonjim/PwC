// AX 인재전쟁 제출 앱 — 지금은 배포 테스트용 첫 화면만 보여 줍니다.
const http = require("http");

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";

const page = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AX 인재전쟁 배포 테스트</title>
</head>
<body>
  <h1>AX 인재전쟁 배포 테스트</h1>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const path = (req.url || "/").split("?")[0];

  if (path === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("ok");
  }

  if (path === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT}`);
});
