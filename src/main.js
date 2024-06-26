import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import jwt from 'jsonwebtoken'

import {
  registerUser,
  loginUser,
  createPost,
  getPosts,
  getPostByID,
  getUserById,
  deletePost,
  updatePost
} from './db.js'

import authenticateToken from './middleware.js'

const app = express()
app.use(express.json())

app.use(bodyParser.json())

app.use(cors())


const port = 5000

app.get('/', async (req, res) => {
  res.send('Hello world from API!')
})

app.post('/register', async (req, res) => {
  const { username, password_md5, email } = req.body
  console.log(req.body)

  try {
    await registerUser(username, password_md5, email)
    res.status(200).json({ status: 'success', message: 'User registered succesully.' })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.post('/login', async (req, res) => {
  const { username, password_md5 } = req.body

  try {
    const user = await loginUser(username, password_md5)
    if (user) {
      const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '24h'
      })
      res.status(200).json({
        status: 'success',
        message: 'User logged in successfully',
        username: user.username,
        token,
        role: user.role,
        id: user.id
      })
    } else {
      res.status(401).json({ status: 'failed', message: 'Invalid username or password.' })
    }
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.get('/user/:id', async (req, res) => {
  const id = req.params.id
  try {
    const user = await getUserById(id)
    res.status(200).json({ status: 'success', data: user })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.get('/posts', async (req, res) => {
  try {
    const posts = await getPosts()
    if (posts !== 'No posts found.') {
      res
        .status(200)
        .json({ status: 'success', message: 'Posts retrieved successfully.', data: posts })
    } else {
      res.status(404).json({ status: 'failed', message: 'No posts found.' })
    }
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.get('/post/:id', async (req, res) => {
  const id = req.params.id
  try {
    const post = await getPostByID(id)
    res.status(200).json({ status: 'success', data: post })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.post('/post', authenticateToken, async (req, res) => {
  const { title, information, author_id, author_name, family, diet, funfact } = req.body

  try {
    await createPost(title, information, author_id, author_name, family, diet, funfact)
    res.status(201).json({ status: 'success', message: 'Post created successfully.' })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.put('/post/:id', authenticateToken, async (req, res) => {
  const id = req.params.id
  const { title, information, family, diet, funfact} = req.body
  try {
    await updatePost(id, title, information, family, diet, funfact)
    res.status(200).json({ status: 'success', message: 'Post updated successfully.' })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})
app.delete('/post/:id', async (req, res) => {
  const id = req.params.id
  try {
    const result = await deletePost(id)
    res.status(200).json({ status: 'success', message: result })
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message })
  }
})

app.listen(port, () => {
  console.log(`Server listening at http://127.0.0.1:${port}`)
})
