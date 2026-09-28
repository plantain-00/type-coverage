import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import fg = require('fast-glob')
// eslint-disable-next-line @typescript-eslint/no-require-imports
import normalize = require('normalize-path')

/**
 * @public
 */
export async function getProjectRootNamesAndCompilerOptions(project: string) {
  const { configFilePath, dirname } = getTsConfigFilePath(project)
  const config = await getTsConfig(configFilePath, dirname, dirname)

  const { options: compilerOptions, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, config.basePath || dirname)
  if (errors && errors.length > 0) {
    throw errors
  }

  const rootNames = await getRootNames(config, dirname)
  if (compilerOptions.baseUrl) {
    if (compilerOptions.baseUrl === '.'
      || compilerOptions.baseUrl === '..'
      || compilerOptions.baseUrl.startsWith(`.${path.sep}`)
      || compilerOptions.baseUrl.startsWith(`..${path.sep}`)
      || compilerOptions.baseUrl.startsWith('./')
      || compilerOptions.baseUrl.startsWith('../')
    ) {
      compilerOptions.baseUrl = path.resolve(path.resolve(process.cwd(), dirname), compilerOptions.baseUrl)
    }
  }
  
  return { rootNames, compilerOptions }
}

function tryToStatFile(filePath: string) {
  const jsonFilePath = filePath.endsWith('.json') ? filePath : filePath + '.json'
  try {
    return {
      path: jsonFilePath,
      stats: fs.statSync(jsonFilePath),
    }
  } catch {
    if (jsonFilePath === filePath) {
      return undefined
    }
    try {
      return {
        path: filePath,
        stats: fs.statSync(filePath),
      }
    } catch {
      return undefined
    }
  }
}

export function getTsConfigFilePath(project: string, fallbackProject?: string[]) {
  let configFilePath: string
  let dirname: string
  let projectStats: fs.Stats | undefined

  let result = tryToStatFile(project)
  if (result) {
    project = result.path
    projectStats = result.stats
  } else if (fallbackProject) {
    while (fallbackProject.length > 0) {
      result = tryToStatFile(fallbackProject[0]!)
      if (result) {
        project = result.path
        projectStats = result.stats
        break
      } else {
        fallbackProject.shift()
      }
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
  extends?: string | string[]
  compilerOptions?: { baseUrl?: string; outDir?: string; [name: string]: unknown }
  include?: string[]
  includeBasePath?: string
  exclude?: string[]
  excludeBasePath?: string
  files?: string[]
  filesBasePath?: string
  basePath?: string
  configDir?: string
}

async function getTsConfig(configFilePath: string, dirname: string, configDir: string): Promise<JsonConfig> {
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
  config.configDir = configDir
  config.includeBasePath = config.include ? dirname : undefined
  config.excludeBasePath = config.exclude ? dirname : undefined
  config.filesBasePath = config.files ? dirname : undefined
  if (config.extends) {
    let lastBasename = dirname
    const extendsArray = Array.isArray(config.extends) ? config.extends : [config.extends]
    let extendsConfig: JsonConfig = {}
    for (const extend of extendsArray) {
      let project: string
      let fallbackProjects: string[] = []
      if (path.isAbsolute(extend)) {
        project = extend
      } else if (extend === '.'
        || extend === '..'
        || extend.startsWith(`.${path.sep}`)
        || extend.startsWith(`..${path.sep}`)
        || extend.startsWith('./')
        || extend.startsWith('../')
      ) {
        project = path.resolve(dirname, extend)
      } else {
        project = path.resolve(dirname, 'node_modules', extend)
        const paths = await findParentsWithNodeModules(dirname)
        fallbackProjects = paths.map(p => path.resolve(p, 'node_modules', extend || ''))
      }
      const { configFilePath, dirname: extendsBasename } = getTsConfigFilePath(project, fallbackProjects)
      lastBasename = extendsBasename;
      const currentExtendsConfig = await getTsConfig(configFilePath, extendsBasename, configDir)
      extendsConfig = {
        ...extendsConfig,
        ...currentExtendsConfig,
        compilerOptions: {
          ...extendsConfig.compilerOptions,
          ...currentExtendsConfig.compilerOptions,
        },
      }
    }
    config.compilerOptions = { ...extendsConfig.compilerOptions, ...config.compilerOptions }
    for (const property of ['include', 'exclude', 'files'] as const) {
      if (config[property] === undefined) {
        config[property] = extendsConfig[property]
        const basePathProperty = `${property}BasePath` as const
        config[basePathProperty] = extendsConfig[basePathProperty]
      }
    }
    const topLevelBaseUrl = config.compilerOptions ? config.compilerOptions.baseUrl : undefined
    config.basePath = topLevelBaseUrl ? dirname : lastBasename;
  }
  return config
}

async function getRootNames(config: JsonConfig, dirname: string) {
  // https://www.typescriptlang.org/tsconfig#include
  let include: string[]
  if (config.include) {
    include = config.include
  } else {
    include = config.files ? [] : ['**/*']
  }

  // https://www.typescriptlang.org/tsconfig#files
  const files = config.files?.map(f => resolveConfigPath(config.filesBasePath || dirname, config.configDir || dirname, f)) ?? []

  if (Array.isArray(include) && include.length > 0) {
    // https://www.typescriptlang.org/tsconfig#exclude
    let exclude: string[]
    let explicitExclude = false
    if (config.exclude) {
      exclude = config.exclude
      explicitExclude = true
    } else {
      exclude = ['node_modules', 'bower_components', 'jspm_packages']
      if (config.compilerOptions?.outDir) {
        exclude.push(config.compilerOptions.outDir)
      }
    }

    // https://github.com/mrmlnc/fast-glob#how-to-exclude-directory-from-reading
    let ignore: string[] = []
    for (const e of exclude) {
      if (explicitExclude) {
        const excludePath = resolveConfigPath(config.excludeBasePath || dirname, config.configDir || dirname, e)
        ignore.push(excludePath, `${excludePath}/**`)
      } else {
        ignore.push(e, `**/${e}`)
      }
    }

    let rules: string[] = []
    for (const file of include) {
      const currentPath = resolveConfigPath(config.includeBasePath || dirname, config.configDir || dirname, file)
      const stats = await statAsync(currentPath)
      if (stats === undefined || stats.isFile()) {
        rules.push(currentPath)
      } else if (stats.isDirectory()) {
        rules.push(`${currentPath.endsWith('/') ? currentPath.substring(0, currentPath.length - 1) : currentPath}/**/*`)
      }
    }

    rules = rules.map((r) => normalize(r))
    ignore = ignore.map((r) => normalize(r))
    const includeFiles = await fg(rules, {
      ignore,
      cwd: dirname,
    })
    files.push(...includeFiles)
  }

  return files.map((r) => path.resolve(process.cwd(), dirname, r))
}

function resolveConfigPath(basePath: string, configDir: string, filePath: string) {
  return path.resolve(basePath, filePath.replaceAll('${configDir}', configDir))
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
