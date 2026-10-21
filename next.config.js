/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep pdf2json out of the webpack bundle (it reads files at runtime).
    serverComponentsExternalPackages: ["pdf2json"],
    // The Typst template catalog + thumbnails are read from disk at runtime
    // (PDFs themselves are rendered by the worker).
    outputFileTracingIncludes: {
      "/api/companies": ["./templates/typst/*/meta.json"],
      "/api/documents/[id]": ["./templates/typst/*/meta.json"],
      "/api/templates": ["./templates/typst/*/meta.json"],
      "/api/templates/typst/[id]/thumbnail": ["./templates/typst/*/thumbnail.png"],
    },
  },
};

module.exports = nextConfig;
