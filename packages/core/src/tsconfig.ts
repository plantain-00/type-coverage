import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import fg = require('fast-glob')
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
