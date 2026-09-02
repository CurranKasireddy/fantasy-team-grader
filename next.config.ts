import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — otherwise Turbopack's lockfile-based
  // inference can wander up to a stray package-lock.json in the home dir.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
