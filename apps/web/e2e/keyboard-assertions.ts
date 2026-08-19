import { expect, type Locator, type Page } from '@playwright/test';

export async function tabTo(
  page: Page,
  target: Locator,
  maximumSteps = 100,
): Promise<void> {
  for (let step = 0; step < maximumSteps; step += 1) {
    await page.keyboard.press('Tab');
    if (
      await target.evaluate(
        (element) => element.ownerDocument.activeElement === element,
      )
    ) {
      await expectVisibleKeyboardFocus(target);
      return;
    }
  }

  throw new Error(
    `The target was not reachable after ${maximumSteps} sequential Tab presses.`,
  );
}

export async function expectVisibleKeyboardFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  const hasVisibleIndicator = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    const outlineVisible =
      style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    return outlineVisible || style.boxShadow !== 'none';
  });
  expect(hasVisibleIndicator).toBe(true);
}
