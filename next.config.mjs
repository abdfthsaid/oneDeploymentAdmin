/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  cashComponent: true,
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: [
      "@fortawesome/free-solid-svg-icons",
      "@fortawesome/react-fontawesome",
      "chart.js",
      "react-chartjs-2",
    ],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

export default nextConfig;
