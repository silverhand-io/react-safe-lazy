import { type ComponentType, lazy } from 'react';

/** The default key used to store the force-reloaded function information in the session storage. */
export const defaultStorageKey = 'forceReloadedImportFunctions';

/**
 * A utility class for storing the names of functions and the number of times they have been
 * force-reloaded. The information is stored in the session storage.
 */
export class ForceReloadStorage {
  constructor(public readonly storageKey = defaultStorageKey) {}

  /**
   * Returns a map of function names and the number of times they have been force-reloaded. The map
   * is retrieved and parsed from the session storage.
   *
   * @example
   * Given that the session storage contains the following:
   *
   * ```json
   * { "forceReloadedFunctionNames": "[[\"functionName\", 1]]" }
   * ```
   *
   * The following code will return a map as the comment indicates:
   *
   * ```ts
   * const storage = new ForceReloadStorage();
   * const stored = storage.getMap(); // Map { 'functionName' => 1 }
   * ```
   */
  getMap(): Map<string, number> {
    const stored = sessionStorage.getItem(this.storageKey);

    try {
      const parsed: unknown = stored ? JSON.parse(stored) : {};
      return new Map(
        Array.isArray(parsed)
          ? parsed.filter(
              (value) =>
                Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'number'
            )
          : undefined
      );
    } catch (error) {
      console.error(error);
      return new Map();
    }
  }

  /**
   * Adds a function name to the storage. If the function name already exists, the number of times it
   * has been force-reloaded is incremented.
   *
   * @param functionName - The name of the function to add.
   */
  addFunction(functionName: string) {
    const stored = this.getMap();
    stored.set(functionName, (stored.get(functionName) ?? 0) + 1);
    this.save(stored);
  }

  /**
   * Removes a function name from the storage. Note that this will clear the force-reload count for
   * the function.
   *
   * If the function name does not exist, nothing happens.
   *
   * @param functionName - The name of the function to remove.
   */
  removeFunction(functionName: string) {
    const stored = this.getMap();
    stored.delete(functionName);
    this.save(stored);
  }

  protected save(stored: Map<string, number>) {
    sessionStorage.setItem(this.storageKey, JSON.stringify([...stored.entries()]));
  }
}

type ForceReloadConfig = {
  /**
   * The maximum number of times to reload the page (using `window.location.reload`) if the
   * component fails to load.
   */
  maxRetries: number;
  /**
   * The key used to store the force-reloaded function information in the session storage.
   *
   * @default 'forceReloadedImportFunctions'
   */
  storageKey?: string;
};

type SafeLazyConfigInit = {
  /**
   * The configuration for force-reloading components that fail to load.
   * - If `false`, force-reloading is disabled.
   * - If it is an object, the following properties are available:
   *   - `maxRetries` - The maximum number of times to reload the page (using `window.location.reload`)
   *     if the component fails to load.
   *   - `storageKey` - The key used to store the force-reloaded function information in the session
   *    storage.
   *
   * @default
   * { maxRetries: 1, storageKey: 'forceReloadedImportFunctions' }
   */
  forceReload?: false | Partial<ForceReloadConfig>;
  /**
   * The number of times to retry importing the component if it fails to load.
   *
   * @default 0
   */
  importRetries?: number;
};

type SafeLazyConfig = {
  forceReload: ForceReloadConfig;
  importRetries: number;
};

const createConfig = (init: SafeLazyConfigInit = {}): SafeLazyConfig => ({
  forceReload: {
    maxRetries: 1,
    ...(typeof init.forceReload === 'object'
      ? init.forceReload
      : init.forceReload === false
        ? { maxRetries: 0 }
        : undefined),
  },
  importRetries: typeof init.importRetries === 'number' ? init.importRetries : 0,
});

/**
 * Creates a `safeLazy` function using the provided configuration.
 *
 * @param config - The configuration for the `safeLazy` function.
 * @returns A `safeLazy` function.
 */
export const createSafeLazy = (config: SafeLazyConfigInit = {}) => {
  const { forceReload, importRetries } = createConfig(config);
  const reloadStorage = new ForceReloadStorage(forceReload.storageKey);

  /**
   * A wrapper around React's `lazy` function that uses the provided configuration to handle
   * component loading errors.
   */
  const safeLazy = <T>(importFunction: () => Promise<{ default: ComponentType<T> }>) => {
    // eslint-disable-next-line @silverhand/fp/no-let
    let retried = 0;
    const tryImport = async () => {
      try {
        return await importFunction();
      } catch (error) {
        console.error(error);

        if (retried < importRetries) {
          // eslint-disable-next-line @silverhand/fp/no-mutation
          retried++;
          return tryImport();
        }

        throw error;
      }
    };
    const functionString = importFunction.toString();

    return lazy(async () => {
      try {
        const component = await tryImport();

        // If force reload is enabled, remove the function name from the storage to clear the retry
        // count
        if (forceReload.maxRetries > 0) {
          reloadStorage.removeFunction(functionString);
        }
        return component;
      } catch (error) {
        if ((reloadStorage.getMap().get(functionString) ?? 0) < forceReload.maxRetries) {
          reloadStorage.addFunction(functionString);
          window.location.reload();
          return { default: () => null };
        }

        throw error;
      }
    });
  };

  return safeLazy;
};

/**
 * A `safeLazy` function with default configuration.
 *
 * - It will not retry importing the component if it fails to load.
 * - It will reload the page once if the component fails to load. If the lazy component fails to
 *   load again, the error will be thrown.
 */
export const safeLazy = createSafeLazy();
