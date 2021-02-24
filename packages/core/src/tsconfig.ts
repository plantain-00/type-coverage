import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import glob = require('glob')

/**
 * @public
 */
export async function getProjectRootNamesAndCompilerOptions(project: string) {
  const { configFilePath, dirname } = getTsConfigFilePath(project)
  const config = await getTsConfig(configFilePath, dirname)

  const { options: compilerOptions, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, config.basePath || dirname)
  if (errors && errors.length > 0) {
    throw errors
  }

  const rootNames = await getRootNames(config, dirname)
  return { rootNames, compilerOptions }
}

function getTsConfigFilePath(project: string, fallbackProject?: string[]) {
  let configFilePath: string
  let dirname: string
  let projectStats: fs.Stats | undefined
  try {
    projectStats = fs.statSync(project)
  } catch (error: unknown) {
    if (fallbackProject) {
      while (fallbackProject.length > 0) {
        try {
          project = fallbackProject[0]
          projectStats = fs.statSync(project)
          break
        } catch {
          fallbackProject.shift()
        }
      }
    } else {
      throw error
    }
  }
  if (!projectStats) {
    try {
      projectStats = fs.statSync(project + '.json')
      if (projectStats) {
        project = project + '.json'
      }
    } catch {
      // do nothing
    }
  }
  if (projectStats && projectStats.isDirectory()) {
    configFilePath = path.resolve(project, 'tsconfig.json')
    dirname = project
  } else if (projectStats && projectStats.isFile()) {
    configFilePath = project
    dirname = path.dirname(project)
  } else {
    throw new Error("paramter 'project' should be a file or directory.")
  }
  return { configFilePath, dirname }
}

interface JsonConfig {
  extends?: string
  compilerOptions?: { baseUrl?: string; [name: string]: unknown }
  include?: string[]
  exclude?: string[]
  files?: string[]
  basePath?: string
}

async function getTsConfig(configFilePath: string, dirname: string): Promise<JsonConfig> {
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
    let project: string
    let fallbackProjects: string[] = []
    if (path.isAbsolute(config.extends)) {
      project = config.extends
    } else if (config.extends === '.'
      || config.extends === '..'
      || config.extends.startsWith(`.${path.sep}`)
      || config.extends.startsWith(`..${path.sep}`)
      || config.extends.startsWith('./')
      || config.extends.startsWith('../')
    ) {
      project = path.resolve(dirname, config.extends)
    } else {
      project = path.resolve(dirname, 'node_modules', config.extends)
      const paths = await findParentsWithNodeModules(dirname)
      fallbackProjects = paths.map(p => path.resolve(p, 'node_modules', config.extends || ''))
    }
    const { configFilePath, dirname: extendsBasename } = getTsConfigFilePath(project, fallbackProjects)
    const extendsConfig = await getTsConfig(configFilePath, extendsBasename)
    const topLevelBaseUrl = config.compilerOptions ? config.compilerOptions.baseUrl : undefined
    config.compilerOptions = { ...extendsConfig.compilerOptions, ...config.compilerOptions }
    config.basePath = topLevelBaseUrl ? dirname : extendsBasename;
  }
  return config
}

async function getRootNames(config: JsonConfig, dirname: string) {
  const include: string[] | undefined = config.include
  // exclude only works when include exists: https://www.typescriptlang.org/tsconfig#exclude
  const exclude: string[] | undefined = include ? config.exclude || ['node_modules/**'] : ['node_modules/**']

  const files = config.files?.map(f => path.resolve(dirname, f)) ?? []

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
    const includeFiles = await globAsync(rules.length === 1 ? rules[0] : `{${rules.join(',')}}`, exclude, dirname)
    return [...files, ...includeFiles]
  }

  if (config.files) {
    return files
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

async function findParentsWithNodeModules(dir: string) {
  const result = [process.cwd()]
  dir = path.resolve(dir)
  for (let i = 0; i < 3; i++) {
    dir = path.dirname(dir)
    const stats = await statAsync(path.resolve(dir, 'node_modules'))
    if (stats && stats.isDirectory() && !result.includes(dir)) {
      result.push(dir)
    }
  }
  return result
}
