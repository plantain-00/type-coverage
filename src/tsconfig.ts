import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import glob from 'glob'

export function getTsConfigFilePath(project: string) {
  let configFilePath: string
  let basename: string
  const projectStats = fs.statSync(project)
  if (projectStats.isDirectory()) {
    configFilePath = path.resolve(project, 'tsconfig.json')
    basename = project
  } else if (projectStats.isFile()) {
    configFilePath = project
    basename = path.basename(project)
  } else {
    throw new Error("paramter '-p' should be a file or directory.")
  }
  return { configFilePath, basename }
}

type JsonConfig = {
  extends?: string
  compilerOptions?: { [name: string]: any }
  include?: string[]
  exclude?: string[]
  files?: string[]
}

export function getTsConfig(configFilePath: string, basename: string): JsonConfig {
  const configResult = ts.readConfigFile(configFilePath, p => fs.readFileSync(p).toString())
  if (configResult.error) {
    throw configResult.error
  }
  const config = configResult.config as JsonConfig
  if (config.extends) {
    const project = path.resolve(basename, config.extends)
    const { configFilePath, basename: extendsBasename } = getTsConfigFilePath(project)
    const extendsConfig = getTsConfig(configFilePath, extendsBasename)
    config.compilerOptions = { ...extendsConfig.compilerOptions, ...config.compilerOptions }
  }
  return config
}

// tslint:disable-next-line:cognitive-complexity
export async function getRootNames(config: JsonConfig, basename: string) {
  const include: string[] | undefined = config.include
  const exclude: string[] | undefined = config.exclude || ['./node_modules/**']

  if (config.files) {
    return config.files.map(f => path.relative(process.cwd(), path.resolve(basename, f)))
  }
  if (include && Array.isArray(include) && include.length > 0) {
    const rules: string[] = []
    for (const file of include) {
      const stats = await statAsync(file)
      if (stats.isDirectory()) {
        rules.push(`${file.endsWith('/') ? file.substring(0, file.length - 1) : file}/**/*.{ts,tsx}`)
      } else if (stats.isFile()) {
        rules.push(file)
      }
    }
    return globAsync(rules.length === 1 ? rules[0] : `{${rules.join(',')}}`, exclude)
  }
  return globAsync(`${basename}/**/*.{ts,tsx}`, exclude)
}

function statAsync(file: string) {
  return new Promise<fs.Stats>((resolve, reject) => {
    fs.stat(file, (error, stats) => {
      if (error) {
        reject(error)
      } else {
        resolve(stats)
      }
    })
  })
}

function globAsync(pattern: string, ignore?: string | string[]) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, { ignore }, (error, matches) => {
      if (error) {
        reject(error)
      } else {
        resolve(matches)
      }
    })
  })
}
