/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPropertyDescriptor(obj: any, name: string) {
  if (obj) {
    return (
      Object.getOwnPropertyDescriptor(obj, name) ||
      getPropertyDescriptor(Object.getPrototypeOf(obj), name)
    );
  }
}

/**
 * Create immutable proxies for all `properties` on `obj` proxying to `impl`.
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function createFrozenProxy<T>(obj: object, impl: T, properties: string[]): T {
  const missingDescriptors = properties.filter(
    name => getPropertyDescriptor(impl, name) === undefined
  );

  if (missingDescriptors.length > 0) {
    throw new Error(
      `Implementation is not complete, missing properties: ${missingDescriptors.join(', ')}`
    );
  }

  return Object.freeze(
    properties.reduce((proxy, name) => {
      const desc = getPropertyDescriptor(impl, name);

      if ('value' in desc) {
        if (typeof desc.value === 'function') {
          proxy[name] = desc.value.bind(impl);
        } else {
          proxy[name] = desc.value;
        }
        return proxy;
      } else {
        return Object.defineProperty(proxy, name, {
          get: desc.get.bind(impl)
        });
      }
    }, obj)
  );
}
