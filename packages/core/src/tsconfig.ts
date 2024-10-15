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
  const config = await getTsConfig(configFilePath, dirname)

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

function getTsConfigFilePath(project: string, fallbackProject?: string[]) {
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
    let lastBasename = dirname
    const extendsArray = Array.isArray(config.extends) ? config.extends : [config.extends]
    let extendsCompilerOptions: JsonConfig = {};
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
      const extendsConfig = await getTsConfig(configFilePath, extendsBasename);
      extendsCompilerOptions = { ...extendsCompilerOptions, ...extendsConfig.compilerOptions }
    }
    config.compilerOptions = { ...extendsCompilerOptions, ...config.compilerOptions }
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
  const files = config.files?.map(f => path.resolve(dirname, f)) ?? []

  if (Array.isArray(include) && include.length > 0) {
    // https://www.typescriptlang.org/tsconfig#exclude
    let exclude: string[]
    if (config.exclude) {
      exclude = config.exclude
    } else {
      exclude = ['node_modules', 'bower_components', 'jspm_packages']
      if (config.compilerOptions?.outDir) {
        exclude.push(config.compilerOptions.outDir)
      }
    }

    // https://github.com/mrmlnc/fast-glob#how-to-exclude-directory-from-reading
    let ignore: string[] = []
    for (const e of exclude) {
      ignore.push(e, `**/${e}`)
    }

    let rules: string[] = []
    for (const file of include) {
      const currentPath = path.resolve(dirname, file)
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
