import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },

  experimental: {
    reactCompiler: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    // THIS ALLOWS BUILDS TO COMPLETE WITH TYPE ERRORS.
    // BE CAREFUL WITH THIS IN PRODUCTION.
    ignoreBuildErrors: true,
  },

  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.[js,jsx,ts,tsx]",
      },
    },
  },
};

export default nextConfig;
