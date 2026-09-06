// conn.js
// Selecciona el backend de base de datos segun el modo de ejecucion.
//   - Modo normal (produccion / Vercel): Pool real de PostgreSQL con POSTGRES_URL.
//   - Modo local (--local o LOCAL=true): BD efimera en memoria (memoryDb.js),
//     JavaScript puro sin WASM ni binarios, para los escaneos del laboratorio.
// Ambos backends exponen .query(sql, params) -> { rows }, asi que db.js no cambia.
//
// Solo imports estaticos (nada de import() dinamico, que se cuelga en Windows
// con rutas que tienen tildes/espacios).

import dotenv from 'dotenv'
import pkg from 'pg'
import { MemoryDb } from './memoryDb.js'
import { seedLocalDb } from './seed.js'

dotenv.config()
const { Pool } = pkg

// El run es "local" si esta el flag --local o la variable LOCAL=true.
export const isLocal =
  process.argv.includes('--local') || process.env.LOCAL === 'true'

// Cliente real que usan las consultas.
let realClient = null

// En modo normal el Pool se crea al cargar el modulo (conexion perezosa: no
// bloquea ni truena si la BD no responde en ese instante). Asi el cliente queda
// listo en entornos serverless (Vercel), donde NO se llama initDb(). En modo
// local, realClient lo asigna initDb() luego de sembrar la BD en memoria.
if (!isLocal) {
  const url = process.env.POSTGRES_URL || ''
  // Evita duplicar sslmode si la URL ya lo trae (p.ej. las de Neon).
  const connectionString = url.includes('sslmode=') ? url : `${url}?sslmode=require`
  realClient = new Pool({ connectionString })
}

// Proxy estable que importa db.js.
const client = {
  query: (...args) => {
    if (!realClient) {
      throw new Error('BD no inicializada: se debe llamar a initDb() antes de consultar.')
    }
    return realClient.query(...args)
  }
}

// Prepara el backend. Se llama solo al correr como servidor tradicional (local),
// no en Vercel (ahi el Pool ya quedo listo arriba).
export async function initDb () {
  if (isLocal) {
    realClient = new MemoryDb() // 100% en memoria, se pierde al cerrar el proceso
    await seedLocalDb(realClient)

    // Fallback de secreto JWT para que el login local funcione sin .env.
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret'
  } else {
    // Chequeo de conexion (solo en desarrollo local): falla temprano y claro
    // si la cadena de conexion esta mal.
    await realClient.query('SELECT 1')
    console.log('Connected to Postgres')
  }
}

export default client
