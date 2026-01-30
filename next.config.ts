import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.wwe.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.wwe.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
