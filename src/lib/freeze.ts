import { Type } from './utils';

/**
 * @hidden
 */
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
export function createImmProxy<T>(obj: object, impl: T, properties: string[]): T {
  const missingDescriptors = properties.filter(
    name => getPropertyDescriptor(impl, name) === undefined
  );

  if (missingDescriptors.length > 0) {
    throw new Error(
      `Implementation is not complete, missing properties: ${missingDescriptors.join(', ')}`
    );
  }

  return properties.reduce((proxy, name) => {
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
  }, obj);
}

/**
 * @hidden
 */
export function createFrozenProxy<T>(impl: T, properties: string[]): T {
  return Object.freeze(createImmProxy({}, impl, properties));
}

/**
 * @hidden
 */
export function frozenClass<T>(cls: Type<T>, properties: string[]): Type<T> {
  return class {
    constructor(...args: any[]) {
      createImmProxy(this, new cls(...args), properties);
      Object.freeze(this);
    }
  } as Type<T>;
}
