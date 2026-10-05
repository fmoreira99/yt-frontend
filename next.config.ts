import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // El sensor ahora vive dentro de Canales.
    return [{ source: '/sensor', destination: '/channels', permanent: false }];
  },
};

export default config;
