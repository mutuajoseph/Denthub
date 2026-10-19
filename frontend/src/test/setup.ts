import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Route screens are lazily imported (issue #66), so the first render of a route
// only commits the Suspense fallback; the chunk resolves on a later tick. Under
// the full parallel suite that transform can take well over Testing Library's
// 1s default, which made the async route assertions flaky. Give `findBy*` /
// `waitFor` a wider window.
configure({ asyncUtilTimeout: 5000 });

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds: readonly number[] = [0];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {}

  observe(): void {}

  unobserve(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
});
