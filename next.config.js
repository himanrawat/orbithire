/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prevent webpack from bundling these packages in server components
    // This is CRITICAL for packages that use fs.readFileSync at runtime
    // JSONResume themes read CSS/template files from disk which breaks when bundled
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "pdf2json",
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
    // Runtime dependencies that need to stay external for server functions
    "@sparticuz/chromium",
    "puppeteer-core",
    // Add any new jsonresume-theme-* packages here
    ],
    // Ensure the Chromium binary is traced into the /api/companies lambda for PDF generation
    outputFileTracingIncludes: {
      "/api/companies": ["./node_modules/@sparticuz/chromium/bin/**", "./templates/typst/*/meta.json"],
      "/api/documents/[id]": ["./node_modules/@sparticuz/chromium/bin/**", "./templates/typst/*/meta.json"],
      "/api/documents/[id]/retry": ["./node_modules/@sparticuz/chromium/bin/**"],
      // Typst template catalog + thumbnails are read from disk at runtime
      "/api/templates": ["./templates/typst/*/meta.json"],
      "/api/templates/typst/[id]/thumbnail": ["./templates/typst/*/thumbnail.png"],
    },
  },
};

module.exports = nextConfig;
