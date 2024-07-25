import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import safeLazy, { createSafeLazy, defaultStorageKey, ForceReloadStorage } from '.';

const storage = new Storage();

beforeAll(() => {
  // @ts-expect-error -- a simplified mock
  vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: vi.fn() });
  vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(storage);

  // Too many errors are logged during testing, suppress them
  vi.spyOn(console, 'error').mockReturnValue();
});

afterEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

describe('default `safeLazy` function', () => {
  it('should not retry importing the component if it fails to load', async () => {
    const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));
    const Component = safeLazy(importFunction);
    const { container } = await act(() => render(<Component />));

    expect(container.childNodes).toHaveLength(0);
    expect(importFunction).toHaveBeenCalledTimes(1);
  });

  it('should reload the page once if the component fails to load', async () => {
    const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));
    const Component = safeLazy(importFunction);
    await act(() => render(<Component />));

    const Component2 = safeLazy(importFunction);
    await expect(async () => {
      await act(() => render(<Component2 />));
    }).rejects.toThrow('Failed to load component');

    expect(importFunction).toHaveBeenCalledTimes(2);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('should render the component if it loads after a failed attempt', async () => {
    const reloadStorage = new ForceReloadStorage();
    const importFunction = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to load component'))
      .mockResolvedValueOnce({ default: () => <div>Component</div> });

    const Component = safeLazy(importFunction);
    const { container } = await act(() => render(<Component />));
    expect(container.textContent).toBe('');
    expect(reloadStorage.getMap().size).toBe(1);

    const Component2 = safeLazy(importFunction);
    const { container: container2 } = await act(() => render(<Component2 />));
    expect(container2.textContent).toBe('Component');
    expect(reloadStorage.getMap().size).toBe(0);
  });

  it('should be ok with a malformed storage', async () => {
    storage.setItem(defaultStorageKey, 'invalid');
    const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));
    const Component = safeLazy(importFunction);
    const { container } = await act(() => render(<Component />));

    expect(container.childNodes).toHaveLength(0);
    expect(importFunction).toHaveBeenCalledTimes(1);
  });
});

describe('custom `safeLazy` function', () => {
  describe('with force reload off and import retry off', () => {
    const safeLazy = createSafeLazy({ forceReload: false, importRetries: 0 });

    it('should not retry importing the component if it fails to load', async () => {
      const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));
      const Component = safeLazy(importFunction);
      await expect(async () => {
        // eslint-disable-next-line max-nested-callbacks
        await act(() => render(<Component />));
      }).rejects.toThrow('Failed to load component');

      expect(importFunction).toHaveBeenCalledTimes(1);
      expect(storage.getItem(defaultStorageKey)).toBeNull();
    });
  });

  describe('with force reload off and import retry on', () => {
    const safeLazy = createSafeLazy({ forceReload: false, importRetries: 1 });

    it('should retry importing the component if it fails to load', async () => {
      const importFunction = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to load component'))
        .mockResolvedValueOnce({ default: () => <div>Component</div> });
      const Component = safeLazy(importFunction);
      const { container } = await act(() => render(<Component />));

      expect(importFunction).toHaveBeenCalledTimes(2);
      expect(storage.getItem(defaultStorageKey)).toBeNull();
      expect(container.textContent).toBe('Component');
    });

    it('should not retry importing the component if it fails twice', async () => {
      const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));
      const Component = safeLazy(importFunction);
      await expect(async () => {
        await act(() => render(<Component />));
      }).rejects.toThrow('Failed to load component');

      expect(importFunction).toHaveBeenCalledTimes(2);
      expect(storage.getItem(defaultStorageKey)).toBeNull();
    });
  });

  describe('with custom storage key and force reload limit', () => {
    const storageKey = 'customKey';
    const safeLazy = createSafeLazy({ forceReload: { storageKey, maxRetries: 2 } });
    const reloadStorage = new ForceReloadStorage(storageKey);

    it('should reload the page twice if the component fails to load', async () => {
      const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));

      // eslint-disable-next-line @silverhand/fp/no-let, @silverhand/fp/no-mutation
      for (let i = 1; i <= 2; i++) {
        const Component = safeLazy(importFunction);
        // eslint-disable-next-line no-await-in-loop
        const { container } = await act(() => render(<Component />));
        expect(container.childNodes).toHaveLength(0);
        expect(importFunction).toHaveBeenCalledTimes(i);
        expect([...reloadStorage.getMap().entries()]).toEqual([[importFunction.toString(), i]]);
      }

      const Component = safeLazy(importFunction);
      await expect(async () => {
        await act(() => render(<Component />));
      }).rejects.toThrow('Failed to load component');
    });
  });

  describe('with custom force reload limit and import retry limit', () => {
    const safeLazy = createSafeLazy({ forceReload: { maxRetries: 2 }, importRetries: 2 });
    const reloadStorage = new ForceReloadStorage();

    it('should retry importing the component if it fails to load', async () => {
      const importFunction = vi.fn().mockRejectedValue(new Error('Failed to load component'));

      // eslint-disable-next-line @silverhand/fp/no-let, @silverhand/fp/no-mutation
      for (let i = 1; i <= 2; i++) {
        const Component = safeLazy(importFunction);
        // eslint-disable-next-line no-await-in-loop
        const { container } = await act(() => render(<Component />));

        expect(importFunction).toHaveBeenCalledTimes(3 * i);
        expect([...reloadStorage.getMap().entries()]).toEqual([[importFunction.toString(), i]]);
        expect(container.childNodes).toHaveLength(0);
      }

      importFunction.mockResolvedValueOnce({ default: () => <div>Component</div> });
      const Component = safeLazy(importFunction);
      const { container } = await act(() => render(<Component />));

      expect(importFunction).toHaveBeenCalledTimes(7);
      expect(reloadStorage.getMap().size).toBe(0);
      expect(container.textContent).toBe('Component');
    });
  });
});
