/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        pdf2json: "commonjs pdf2json",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
