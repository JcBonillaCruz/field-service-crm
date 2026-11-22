import createNextIntlPlugin from "next-intl/plugin";

// Paso 6.1: idioma inglés / español (sin /es en la URL; ver src/i18n/request.ts)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
