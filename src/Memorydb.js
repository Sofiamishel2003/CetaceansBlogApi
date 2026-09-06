// memoryDb.js
// Base de datos EFIMERA en memoria, en JavaScript puro (sin WASM ni binarios).
// Reemplaza a PGlite en modo local para evitar el cuelgue de inicializacion.
// Implementa .query(sql, params) -> { rows } reconociendo exactamente las
// consultas que usa la API (db.js y seed.js), asi que db.js no cambia nada.
//
// Nota: las vulnerabilidades del lab viven en la capa HTTP/app (MD5, DELETE sin
// auth, SELECT * que expone el hash, etc.) y se conservan tal cual. El codigo ya
// usa consultas parametrizadas, por lo que no hay SQLi que se pierda al no usar
// un motor SQL real.

import crypto from 'crypto'

// MD5 igual que Postgres MD5(): mismo algoritmo, para que el login coincida.
const md5 = (value) => crypto.createHash('md5').update(String(value)).digest('hex')

// Normaliza el SQL (colapsa espacios y pasa a minusculas) para poder enrutar.
const norm = (sql) => sql.replace(/\s+/g, ' ').trim().toLowerCase()

export class MemoryDb {
  constructor () {
    this.users = [] // { id, username, password_md5, email, role }
    this.posts = [] // { id, title, information, author_id, author_name, family, diet, funfact, created_at, updated_at }
    this.nextUserId = 1
    this.nextPostId = 1
  }

  // seed.js llama db.exec(schema) para crear tablas: aqui no hace falta (las
  // "tablas" son arreglos), asi que se ignora el DDL sin romper el flujo.
  async exec () {
    return { rows: [] }
  }

  // Punto de entrada compatible con pg / PGlite.
  async query (sql, params = []) {
    const q = norm(sql)

    // --- USERS -------------------------------------------------------------

    // register: INSERT INTO users (username, password_md5, email) VALUES ($1, MD5($2), $3)
    // seed:     INSERT INTO users (username, password_md5, email, role) VALUES ($1, MD5($2), $3, $4)
    if (q.startsWith('insert into users')) {
      const [username, rawPassword, email, role] = params
      this.users.push({
        id: this.nextUserId++,
        username,
        password_md5: md5(rawPassword), // el SQL envuelve $2 en MD5()
        email,
        role: role || 'Usuario' // register no manda rol -> valor por defecto
      })
      return { rows: [], rowCount: 1 }
    }

    // login: SELECT id, username, email, role FROM users WHERE username = $1 AND password_md5 = MD5($2)
    if (q.startsWith('select id, username, email, role from users')) {
      const [username, rawPassword] = params
      const hash = md5(rawPassword)
      const u = this.users.find(x => x.username === username && x.password_md5 === hash)
      // Solo las columnas que pide el SELECT.
      const rows = u ? [{ id: u.id, username: u.username, email: u.email, role: u.role }] : []
      return { rows, rowCount: rows.length }
    }

    // getUserById: SELECT * FROM users WHERE id = $1
    if (q.startsWith('select * from users where id')) {
      const id = Number(params[0])
      const rows = this.users.filter(x => x.id === id)
      return { rows, rowCount: rows.length }
    }

    // --- BLOG_POSTS --------------------------------------------------------

    // getPostByID: SELECT * FROM blog_posts WHERE id = $1
    if (q.startsWith('select * from blog_posts where id')) {
      const id = Number(params[0])
      const rows = this.posts.filter(p => p.id === id)
      return { rows, rowCount: rows.length }
    }

    // getPosts: SELECT * FROM blog_posts
    if (q.startsWith('select * from blog_posts')) {
      return { rows: [...this.posts], rowCount: this.posts.length }
    }

    // createPost / seed: INSERT INTO blog_posts (title, information, author_id, author_name, family, diet, funfact) VALUES ($1..$7)
    if (q.startsWith('insert into blog_posts')) {
      const [title, information, author_id, author_name, family, diet, funfact] = params
      const now = new Date()
      this.posts.push({
        id: this.nextPostId++,
        title,
        information,
        author_id: Number(author_id),
        author_name,
        family,
        diet,
        funfact,
        created_at: now,
        updated_at: now
      })
      return { rows: [], rowCount: 1 }
    }

    // updatePost: UPDATE blog_posts SET title=$1, information=$2, family=$3, diet=$4, funfact=$5 WHERE id=$6
    if (q.startsWith('update blog_posts set')) {
      const [title, information, family, diet, funfact, id] = params
      const post = this.posts.find(p => p.id === Number(id))
      if (post) {
        Object.assign(post, { title, information, family, diet, funfact, updated_at: new Date() })
      }
      return { rows: [], rowCount: post ? 1 : 0 }
    }

    // deletePost: DELETE FROM blog_posts WHERE id = $1
    if (q.startsWith('delete from blog_posts where id')) {
      const id = Number(params[0])
      const before = this.posts.length
      this.posts = this.posts.filter(p => p.id !== id)
      return { rows: [], rowCount: before - this.posts.length }
    }

    // Chequeo de conectividad (no se usa en local, pero por si acaso).
    if (q === 'select 1') {
      return { rows: [{ '?column?': 1 }], rowCount: 1 }
    }

    // Cualquier consulta no prevista: error claro en vez de fallar en silencio.
    throw new Error(`MemoryDb: consulta no soportada -> ${sql}`)
  }
}
