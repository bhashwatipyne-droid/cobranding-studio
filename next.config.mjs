/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Fabric canvases are imperative; avoid double-mount churn in dev
  serverExternalPackages: ["cheerio", "@neplex/vectorizer"],
};
export default nextConfig;
