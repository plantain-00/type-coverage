import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import glob from 'glob'

/**
 * @public
 */
export async function getProjectRootNamesAndCompilerOptions(project: string) {
  const { configFilePath, dirname } = getTsConfigFilePath(project)
  const config = getTsConfig(configFilePath, dirname)

  const { options: compilerOptions, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, dirname)
  if (errors && errors.length > 0) {
    throw errors
  }

  const rootNames = await getRootNames(config, dirname)
  return { rootNames, compilerOptions }
}

function getTsConfigFilePath(project: string) {
  let configFilePath: string
  let dirname: string
  const projectStats = fs.statSync(project)
  if (projectStats.isDirectory()) {
    configFilePath = path.resolve(project, 'tsconfig.json')
    dirname = project
  } else if (projectStats.isFile()) {
    configFilePath = project
    dirname = path.dirname(project)
  } else {
    throw new Error("paramter 'project' should be a file or directory.")
  }
  return { configFilePath, dirname }
}

interface JsonConfig {
  extends?: string
  compilerOptions?: { [name: string]: unknown }
  include?: string[]
  exclude?: string[]
  files?: string[]
}

function getTsConfig(configFilePath: string, dirname: string): JsonConfig {
  const configResult = ts.readConfigFile(configFilePath, p => fs.readFileSync(p).toString())
  const config = configResult.error ? {
    extends: undefined,
    compilerOptions: {
      lib: [
        'dom',
        'es5',
        'es2015',
        'es2016',
        'es2017'
      ],
      allowSyntheticDefaultImports: true
    }
  } : configResult.config as JsonConfig
  if (config.extends) {
    const project = path.resolve(dirname, config.extends)
    const { configFilePath, dirname: extendsBasename } = getTsConfigFilePath(project)
    const extendsConfig = getTsConfig(configFilePath, extendsBasename)
    config.compilerOptions = { ...extendsConfig.compilerOptions, ...config.compilerOptions }
  }
  return config
}

async function getRootNames(config: JsonConfig, dirname: string) {
  const include: string[] | undefined = config.include
  const exclude: string[] | undefined = config.exclude || ['node_modules/**']

  if (config.files) {
    return config.files.map(f => path.resolve(dirname, f))
  }
  if (include && Array.isArray(include) && include.length > 0) {
    const rules: string[] = []
    for (const file of include) {
      const currentPath = path.resolve(dirname, file)
      const stats = await statAsync(currentPath)
      if (stats === undefined) {
        rules.push(currentPath)
      } else if (stats.isDirectory()) {
        rules.push(`${currentPath.endsWith('/') ? currentPath.substring(0, currentPath.length - 1) : currentPath}/**/*.{ts,tsx}`)
      } else if (stats.isFile()) {
        rules.push(currentPath)
      }
    }
    return globAsync(rules.length === 1 ? rules[0] : `{${rules.join(',')}}`, exclude, dirname)
  }
  const rootNames = await globAsync(`**/*.{ts,tsx}`, exclude, dirname)
  return rootNames.map((r) => path.resolve(process.cwd(), dirname, r))
}

function statAsync(file: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(file, (error, stats) => {
      if (error) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

function globAsync(pattern: string, ignore: string | string[], cwd?: string) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, { ignore, cwd }, (error, matches) => {
      if (error) {
        reject(error)
      } else {
        resolve(matches)
      }
    })
  })
}
