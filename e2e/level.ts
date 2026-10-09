// The side-scrolling level: one press away from the two circles since D-129 (START → Walk the
// level, remembered on the device). Tests of the level's own behaviour (badges on lanyards, swing,
// fling, Pip's walk, the slots) open the hall in it, the way that choice does.
import type { Page } from '@playwright/test';

export const inLevel = (page: Page) => page.addInitScript(() => localStorage.setItem('piphall-hall-view', 'level'));
