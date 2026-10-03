export interface _Selector<T> {
  value: T
}

// A type that names itself as its own type argument,
// like postcss-selector-parser's `Selector`, which is `_Selector<Selector>`.
export type Selector = _Selector<Selector>
