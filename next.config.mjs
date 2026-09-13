/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    imageSizes: [32, 48, 64, 96, 128, 176, 256, 384],
    qualities: [60, 75],
    remotePatterns: [{
      protocol: "https",
      hostname: "photos.rkolaric.com",
      port: "",
      pathname: "/misc/**",
      search: "",
    }],
  },
};

export default nextConfig;
