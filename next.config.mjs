/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the libSQL client (and its optional native bits) out of the bundle so
  // it works in serverless functions on Vercel.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
