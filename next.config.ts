import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.28", "localhost", "127.0.0.1"],
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
