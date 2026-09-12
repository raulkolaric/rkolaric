/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
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
