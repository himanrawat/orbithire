/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prevent webpack from bundling these packages in server components
    // This is CRITICAL for packages that use fs.readFileSync at runtime
    // JSONResume themes read CSS/template files from disk which breaks when bundled
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "pdfjs-dist",
      "pdf-parse",
      // JSONResume themes - these use fs.readFileSync to load assets
      "jsonresume-theme-even",
      "jsonresume-theme-elegant",
      "jsonresume-theme-classy",
      "jsonresume-theme-class",
      "jsonresume-theme-kendall",
      "jsonresume-theme-kwan",
      "jsonresume-theme-onepage",
      "jsonresume-theme-onepage-plus",
      "jsonresume-theme-short",
      "jsonresume-theme-slick",
      "jsonresume-theme-spartan",
      "jsonresume-theme-stackoverflow",
      "jsonresume-theme-straightforward",
      // Add any new jsonresume-theme-* packages here
    ],
  },
};

module.exports = nextConfig;
