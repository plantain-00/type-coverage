declare module '*.json' {
  export const version: string
  export const typeCoverage: {
    atLeast?: number
  }?
}
