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
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      {
        key: "Content-Security-Policy-Report-Only",
        value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; frame-src 'self' https://challenges.cloudflare.com; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; connect-src 'self' https: wss:; form-action 'self'"
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
