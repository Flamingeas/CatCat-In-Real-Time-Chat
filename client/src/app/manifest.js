export default function manifest() {
  return {
    name: 'CatCat',
    short_name: 'CatCat',
    description: "Le coin le plus chill d'Internet.",
    start_url: '/',
    display: 'standalone', // C'est ça qui enlève la barre du navigateur URL !
    background_color: '#0a0605',
    theme_color: '#0a0605',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
    ],
  }
}