declare module 'topojson-simplify' {
  export function presimplify<T>(topology: T): T;
  export function simplify<T>(topology: T, minWeight: number): T;
}
