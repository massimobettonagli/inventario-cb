import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache";

const nextConfig = {
  reactStrictMode: true,
};

const pwaConfig = {
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",

  // ✅ IMPORTANTISSIMO: le API non vanno mai in cache
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "GET",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "POST",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "PATCH",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "PUT",
    },
    {
      urlPattern: /^\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "DELETE",
    },
    // il resto può usare i default
    ...runtimeCaching,
  ],
};

export default withPWA(pwaConfig)(nextConfig);