import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitCommit = "";
try {
  gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Not a git repo or git not available
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
  },
};

export default nextConfig;
