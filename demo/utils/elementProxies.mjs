function createProxyConstructor(type) {
  return function(context) {
    return new Proxy(new Map(), {
      get(obj, property) {
        if (!obj.has(property)) {
          obj.set(property, context.querySelector(`[data-${type}=${property}]`));
        }
        return obj.get(property);
      },
      set(obj, property, value) {
        if (typeof value === 'string') {
          obj.set(property, context.querySelector(`[data-${type}=${property}]`));
        } else if (value.nodeType) {
          obj.set(property, value);
        }
      },
      deleteProperty(obj, property) {
        return obj.delete(property);
      }
    });
  };
}

export const NodesProxy = createProxyConstructor('selector');
export const ActionsProxy = createProxyConstructor('action');
