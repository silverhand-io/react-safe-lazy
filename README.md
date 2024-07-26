# react-safe-lazy

![GitHub branch check runs](https://img.shields.io/github/check-runs/silverhand-io/react-safe-lazy/master)
[![codecov](https://codecov.io/gh/silverhand-io/react-safe-lazy/graph/badge.svg?token=JXZ4C50SCV)](https://codecov.io/gh/silverhand-io/react-safe-lazy)
![NPM version](https://img.shields.io/npm/v/react-safe-lazy)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/react-safe-lazy)

A simple and safe way to use `React.lazy` when you are iterating React app fast. It will catch the error and automatically retry to import or refresh the page when a lazy React component fails to load.

## Installation

```bash
npm i react-safe-lazy
```

- Direct dependencies: 0.
- Peer dependency: `react@^18.0.0`.

## Usage

Just replace `React.lazy` with `safeLazy` and you are good to go.

```tsx
import { safeLazy } from 'react-safe-lazy';

const MyComponent = safeLazy(() => import('./MyComponent'));
```

## Documentation

### The default `safeLazy` function

The default `safeLazy` function have the following strategy:

- It will not retry calling the import function if it fails.
- It will reload the page (`window.location.reload`) once if the lazy component fails to load. If the lazy component fails to load again, the error will be thrown.

### Customizing the `safeLazy` function

You can create a custom `safeLazy` function by calling the `createSafeLazy` function with a configuration object.

```ts
import { createSafeLazy } from 'react-safe-lazy';

const safeLazy = createSafeLazy({ /* configuration */ });
const MyComponent = safeLazy(() => import('./MyComponent'));
```

The configuration object has the following properties:

```ts
type SafeLazyConfigInit = {
  /**
   * The configuration for force-reloading components that fail to load. If set to `false`, the
   * component will not be force-reloaded.
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
```

For example, to retry importing the component 3 times and reload the page up to 2 times if the component fails to load, you can use the following configuration:

```ts
const safeLazy = createSafeLazy({
  importRetries: 3,
  forceReload: {
    maxRetries: 2,
  },
});
```

## License

MIT
