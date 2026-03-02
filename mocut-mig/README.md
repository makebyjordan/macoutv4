# mocut-mig

Migración de MacOut a una arquitectura simple:
- Frontend: `HTML + CSS + JavaScript` (sin Next.js)
- Backend: `Node.js` con módulo nativo `http` (sin frameworks)
- Base de datos básica: archivo JSON en `data/db.json`

## Qué se eliminó
- Firebase / Firebase Admin
- Next.js / React
- Prisma / PostgreSQL
- Genkit y dependencias asociadas

## Estructura
- `server.js`: API REST + servidor estático
- `public/index.html`: landing
- `public/dashboard.html`: panel de gestión
- `public/app.js`: lógica de landing
- `public/dashboard.js`: lógica CRUD del dashboard
- `public/styles.css`: estilos
- `data/db.json`: base de datos básica

## Ejecutar en local
```bash
cd mocut-mig
npm run dev
```

Abre: `http://localhost:9010`

## Acceso dashboard
- Código: `m1c23t`
- Flujo: botón "Entrar al Dashboard" en la landing.

## Endpoints
- `GET/POST /api/products`
- `PUT/DELETE /api/products/:id`
- `GET/POST /api/transactions`
- `PUT/DELETE /api/transactions/:id`
- `GET/POST /api/testimonials`
- `DELETE /api/testimonials/:id`
- `GET /api/dashboard/summary`
- `GET /api/health`
