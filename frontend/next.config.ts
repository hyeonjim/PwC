import type { NextConfig } from "next";

// 화면은 정적 파일(out/)로 내보내고, FastAPI 서버가 그대로 내보낸다.
// 정적 내보내기에서는 서버 기능(cacheComponents, Route Handlers, Server Actions,
// 기본 이미지 최적화 등)을 쓰지 않는다. 데이터는 모두 /api 에서 받아 온다.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
