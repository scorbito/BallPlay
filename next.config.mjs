/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    },
    // 클라이언트 라우터 캐시 — dynamic 페이지를 30초간 재사용.
    // 0이면 뒤로가기·탭 전환마다 서버 RSC를 다시 받아 와 Vercel 함수 호출/CPU가 급증한다.
    // 빠르게 변하는 데이터는 각 화면이 클라이언트에서 다시 패치하므로 30초 staleness는 안전.
    staleTimes: {
      dynamic: 30
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**"
      }
    ]
  }
};

export default nextConfig;
