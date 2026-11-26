import { describe, expect, it } from 'vitest';
import { BUILTIN_LAYER, inList, verdict } from './lists';
import { PACKS, folderLayer, packLayer } from './packs';
import { PRESETS } from './presets';

const REPO = 'o/r';
const pack = (id: string) => PACKS.find(p => p.id === id)!;
const layers = (id: string) => [BUILTIN_LAYER, packLayer(REPO, pack(id))];

describe('stack packs', () => {
  it('iOS: finds XCTest files and swift-snapshot-testing images', () => {
    const l = layers('ios');
    expect(inList(l, 'snapshots', REPO, 'App/Tests/__Snapshots__/HomeTests/testHome.1.png')).toBe(true);
    expect(inList(l, 'snapshots', REPO, 'App/FooTests/ReferenceImages_64/a.png')).toBe(true);
    expect(inList(l, 'tests', REPO, 'App/FooTests/HomeViewModelTests.swift')).toBe(true);
    expect(inList(l, 'generated', REPO, 'Podfile.lock')).toBe(true);
    expect(inList(l, 'snapshots', REPO, 'App/Sources/Home.swift')).toBe(false);
  });
  it('Android: finds Paparazzi/Roborazzi images and test source sets', () => {
    const l = layers('android');
    expect(inList(l, 'snapshots', REPO, 'app/src/test/snapshots/images/a.png')).toBe(true);
    expect(inList(l, 'tests', REPO, 'app/src/androidTest/java/com/x/FooTest.kt')).toBe(true);
    expect(inList(l, 'tests', REPO, 'app/src/main/java/com/x/Foo.kt')).toBe(false);
  });
  it('E2E: finds Playwright snapshot folders', () => {
    const l = layers('e2e');
    expect(inList(l, 'snapshots', REPO, 'tests/login.spec.ts-snapshots/home-chromium.png')).toBe(true);
    expect(inList(l, 'tests', REPO, 'cypress/e2e/login.cy.ts')).toBe(true);
  });
  it('packs stay off until enabled and apply only to their repo', () => {
    const path = 'App/FooTests/ReferenceImages_64/a.png';
    expect(inList([BUILTIN_LAYER], 'snapshots', REPO, path)).toBe(false);
    expect(inList([BUILTIN_LAYER, packLayer('other/repo', pack('ios'))], 'snapshots', REPO, path)).toBe(false);
    expect(inList([BUILTIN_LAYER, packLayer(REPO, pack('ios'))], 'snapshots', REPO, path)).toBe(true);
  });
});

describe('folder layers (monorepos)', () => {
  it('apply only under the folder, relative to it, and beat packs', () => {
    const l = [BUILTIN_LAYER, packLayer(REPO, pack('ios')), folderLayer(REPO, '/apps/ios/', 'snapshots', ['Goldens/**', '!Goldens/keep/**'])];
    expect(inList(l, 'snapshots', REPO, 'apps/ios/Goldens/a.png')).toBe(true);
    expect(inList(l, 'snapshots', REPO, 'apps/ios/Goldens/keep/a.png')).toBe(false);
    expect(inList(l, 'snapshots', REPO, 'apps/android/Goldens/a.png')).toBe(false);
    expect(verdict(l, 'snapshots', REPO, 'apps/ios/Goldens/a.png').decidedBy).toBe('Folder apps/ios/');
  });
});

describe('snapshot presets', () => {
  it('offers both only and hide', () => {
    expect(PRESETS.map(p => p.id)).toContain('only-snapshots');
    expect(PRESETS.map(p => p.id)).toContain('hide-snapshots');
  });
});
