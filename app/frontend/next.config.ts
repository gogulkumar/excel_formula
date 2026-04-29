import type { NextConfig } from "next";

// "standalone" output is only required for Docker/self-hosted deployments.
// Vercel manages its own output optimisation — leave this unset there.
const isDocker = process.env.NEXT_OUTPUT_MODE === "standalone";

const nextConfig: NextConfig = {
  ...(isDocker ? { output: "standalone" } : {}),

  async rewrites() {
    const backendProxyUrl = process.env.BACKEND_PROXY_URL?.replace(/\/$/, "");
    if (!backendProxyUrl) return [];
    return [
      {
        source: "/backend/:path*",
        destination: `${backendProxyUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
