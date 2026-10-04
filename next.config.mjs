/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev-server origins that are allowed to call the app. The e2b wildcard keeps
  // the live preview working; the okgs.info ones let real club subdomains
  // (alssm.okgs.info…) hit the same dev/prod build.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.okgs.info",
    "omarkgschool.com",
    "*.localhost",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
