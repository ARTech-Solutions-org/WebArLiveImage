export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'canvas') {
    return {
      url: new URL('./canvas-shim.mjs', import.meta.url).href,
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}
