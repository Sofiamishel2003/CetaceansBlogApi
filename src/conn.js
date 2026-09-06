// conn.js
// Selecciona el backend de base de datos segun el modo de ejecucion.
//   - Modo normal (produccion): Pool real de PostgreSQL usando POSTGRES_URL.
//   - Modo local (--local o LOCAL=true): BD efimera en memoria (memoryDb.js),
//     JavaScript puro sin WASM ni binarios, para los escaneos del laboratorio.
// Ambos backends exponen .query(sql, params) -> { rows }, asi que db.js no cambia.
//
// IMPORTANTE: se usan SOLO imports estaticos (arriba). Nada de import() dinamico:
// en Windows con rutas que tienen tildes/espacios, el import() dinamico de
// archivos relativos (./seed.js, ./memoryDb.js) puede no resolver nunca y hace
// que el proceso salga en silencio. Los imports estaticos no tienen ese problema.

import dotenv from 'dotenv'
import pkg from 'pg'
import { MemoryDb } from './memoryDb.js'
import { seedLocalDb } from './seed.js'

dotenv.config()
const { Pool } = pkg

// El run es "local" si esta el flag --local o la variable LOCAL=true.
export const isLocal =
  process.argv.includes('--local') || process.env.LOCAL === 'true'

// Cliente real; se asigna en initDb(). Hasta entonces es null.
let realClient = null

// Proxy estable que importa db.js. Reenvia .query al cliente real una vez listo.
const client = {
  query: (...args) => {
    if (!realClient) {
      throw new Error('BD no inicializada: se debe llamar a initDb() antes de consultar.')
    }
    return realClient.query(...args)
  }
}

// Prepara el backend. main.js la espera (await) antes de abrir el servidor.
export async function initDb () {
  if (isLocal) {
    realClient = new MemoryDb() // 100% en memoria, se pierde al cerrar el proceso
    await seedLocalDb(realClient)

    // Fallback de secreto JWT para que el login local funcione sin .env.
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret'
  } else {
    realClient = new Pool({
      connectionString: process.env.POSTGRES_URL + '?sslmode=require'
    })
    await realClient.query('SELECT 1') // falla temprano si la BD real no responde
    console.log('Connected to Postgres')
  }
}

export default client
