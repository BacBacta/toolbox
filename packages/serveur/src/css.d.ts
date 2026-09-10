/**
 * Le CSS importé en chaîne.
 *
 * Vite résout `?raw` en une chaîne à la construction ; TypeScript, lui, ne
 * connaît pas ce suffixe. La déclaration ne fait que le lui dire.
 */
declare module '*.css?raw' {
  const contenu: string
  export default contenu
}
