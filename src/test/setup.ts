import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {}
});

// Mantine's internal hooks (e.g. use-media-query, MantineProvider color
// scheme detection) call window.matchMedia, which jsdom does not implement
// by default. Without this mock, any test rendering a Mantine component
// (Accordion, Modal, Tabs, etc.) fails with
// "TypeError: window.matchMedia is not a function". Always reports
// matches: false — no dark-mode/reduced-motion-specific test need in this
// phase.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});
