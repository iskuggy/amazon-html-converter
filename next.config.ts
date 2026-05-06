import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  basePath: isGithubPages ? "/amazon-html-converter" : undefined,
  assetPrefix: isGithubPages ? "/amazon-html-converter/" : undefined,
};

export default nextConfig;
