import { AtomEffect, DefaultValue } from 'recoil'

export interface PersistStorage {
  setItem(key: string, value: string): void | Promise<void>

  getItem(key: string): null | string | Promise<string>
}

export interface PersistConfiguration {
  key?: string | (() => string)
  storage?: PersistStorage,
}

export interface PersistSetting {
  serialize?: (key) => string,
  deserialize?: (string) => any,
}

const getKey = ({ key }: PersistConfiguration): string => {
  if (typeof key === 'function') {
    return key()
  }

  return key;
}

/**
 * Recoil module to persist state to storage
 *
 * @param config Optional configuration object
 * @param config.key Used as key in local storage, defaults to `recoil-persist`
 * @param config.storage Local storage to use, defaults to `localStorage`
 */
export const recoilPersist = (
  config: PersistConfiguration = {},
): (settings?: PersistSetting) => { persistAtom: AtomEffect<any> } => (settings) => {
  if (typeof window === 'undefined') {
    return {
      persistAtom: () => { },
    }
  }


  const { storage = localStorage } = config;
  const { serialize, deserialize } = settings || {};
  const key = getKey(config);

  const persistAtom: AtomEffect<any> = ({ onSet, node, trigger, setSelf }) => {
    if (trigger === 'get') {
      const state = getState()
      if (typeof state.then === 'function') {
        state.then((s) => {
          if (s.hasOwnProperty(node.key)) {
            setSelf(deserialize ? deserialize(s[node.key]): s[node.key])
          }
        })
      }
      if (state.hasOwnProperty(node.key)) {
        setSelf(deserialize ? deserialize(state[node.key]): state[node.key])
      }
    }

    onSet(async (newValue) => {
      const state = await getState()
      if (
        newValue !== null &&
        newValue !== undefined &&
        newValue instanceof DefaultValue &&
        state.hasOwnProperty(node.key)
      ) {
        delete state[node.key]
      } else {
        state[node.key] = serialize ? serialize(newValue) : newValue
      }

      setState(state)
    })
  }

  const getState = (): any => {
    const toParse = storage.getItem(key)
    if (toParse === null || toParse === undefined) {
      return {}
    }
    if (typeof toParse === 'string') {
      return parseState(toParse)
    }
    if (typeof toParse.then === 'function') {
      return toParse.then(parseState)
    }

    return {}
  }

  const parseState = (state: string) => {
    if (state === undefined) {
      return {}
    }
    try {
      return JSON.parse(state)
    } catch (e) {
      console.error(e)
      return {}
    }
  }

  const setState = (state: any): void => {
    try {
      //TODO for React Native `AsyncStorage`, we should be using `mergeItem`
      // to merge existing stringified object with new one
      storage.setItem(key, JSON.stringify(state))
    } catch (e) {
      console.error(e)
    }
  }

  return { persistAtom }
}

