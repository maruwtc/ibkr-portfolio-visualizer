import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // No landing page: the workspace opens straight on Portfolio.
      // Kept temporary (307) so restoring a home page later isn't fighting cached 308s.
      { source: "/", destination: "/portfolio", permanent: false },
    ];
  },
};

export default nextConfig;
