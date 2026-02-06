# CryptoTracker

Aplicación para visualizar el top de criptomonedas con precio actual, variación 24h y un mini gráfico (sparkline). Permite alternar rápidamente entre USD y CLP y actualiza los datos de forma adaptativa para respetar el rate limit de la API.

## Tecnologías utilizadas
- React + TypeScript
- Vite
- Tailwind CSS
- lucide-react (iconos)
- CoinGecko API (datos de mercado)

## Características
- Tarjetas responsivas con estilo glassmorphism.
- Alternancia USD/CLP con formateo local de moneda.
- Sparkline de 7 días por moneda.
- Skeleton de carga y auto-actualización con backoff ante 429.

## Desarrollo
1. Instalar dependencias:
   ```
   npm install
   ```
2. Levantar servidor:
   ```
   npm run dev
   ```
3. Abrir en el navegador:
   - http://127.0.0.1:5173/

## Notas
- Para mejor compatibilidad de herramientas se recomienda Node.js 18 o superior.
