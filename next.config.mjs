/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  productionBrowserSourceMaps: false,
  async headers() {
    const securityHeaders = [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // images.unoptimized removed — Next.js now handles resizing, lazy-loading, and WebP conversion
};

export default nextConfig;
