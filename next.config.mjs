/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    },
    staleTimes: {
      dynamic: 0
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
