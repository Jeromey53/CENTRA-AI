import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const source = join(root, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const destination = join(root, '..', 'public', 'mediapipe')

mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })