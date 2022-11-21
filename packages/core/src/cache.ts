import * as path from 'path'
import * as fs from 'fs'
import { promisify } from 'util'
import { createHash } from 'crypto'

import { TypeCheckResult } from './interfaces'

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const mkdirAsync = promisify(fs.mkdir)

export async function getFileHash(file: string, enableCache: boolean) {
  return enableCache ? calculateHash((await readFileAsync(file)).toString()) : ''
}

function calculateHash(str: string): string {
  return createHash('sha1').update(str).digest('hex')
}

export async function saveCache(typeCheckResult: TypeCheckResult, dirName = defaultDirName) {
  await mkdirIfmissing(dirName)
  await writeFileAsync(path.resolve(dirName, 'result.json'), JSON.stringify(typeCheckResult, null, 2))
}

const defaultDirName = '.type-coverage'

function statAsync(p: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(p, (err, stats) => {
      if (err) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

async function mkdirIfmissing(dirName = defaultDirName) {
  const stats = await statAsync(dirName)
  if (!stats) {
    await mkdirAsync(dirName, { recursive: true })
  }
}

export async function readCache(enableCache: boolean, dirName = defaultDirName): Promise<TypeCheckResult> {
  if (!enableCache) {
    return {
      cache: {}
    }
  }
  const filepath = path.resolve(dirName, 'result.json')
  const stats = await statAsync(filepath)
  if (stats && stats.isFile()) {
    const text = (await readFileAsync(filepath)).toString()
    const typeCheckResult = JSON.parse(text) as TypeCheckResult
    if (typeCheckResult && Array.isArray(typeCheckResult.cache)) {
      typeCheckResult.cache = {}
    }
    return typeCheckResult
  }
  return {
    cache: {}
  }
}
