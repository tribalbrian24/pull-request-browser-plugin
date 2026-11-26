import type { Layer } from './lists';

export interface Pack {
  id: string;
  label: string;
  hint: string;
  lists: Record<string, string[]>;
}

/** Starting points per stack. They are guesses at common conventions: enable per repo, then adjust with your own patterns. */
export const PACKS: Pack[] = [
  {
    id: 'ios',
    label: 'iOS / Swift',
    hint: 'XCTest folders, swift-snapshot-testing and FBSnapshot reference images, Xcode and CocoaPods churn',
    lists: {
      tests: ['**/*Tests/**', '**/*Tests.swift', '**/*Test.swift', '**/*Spec.swift'],
      snapshots: ['**/__Snapshots__/**', '**/ReferenceImages*/**', '**/FailureDiffs/**'],
      generated: ['**/Pods/**', '**/Podfile.lock', '**/Package.resolved', '**/project.pbxproj', '**/*.xcuserstate'],
    },
  },
  {
    id: 'android',
    label: 'Android / Kotlin',
    hint: 'src/test and src/androidTest, Paparazzi / Roborazzi / Shot screenshot folders, Gradle lockfiles',
    lists: {
      tests: ['**/src/test/**', '**/src/androidTest/**', '**/*Test.{kt,java}', '**/*Tests.{kt,java}'],
      snapshots: ['**/src/test/snapshots/**', '**/src/test/screenshots/**', '**/screenshots/**'],
      generated: ['**/gradle.lockfile', '**/*.gradle.lockfile', '**/gradle/wrapper/**'],
    },
  },
  {
    id: 'e2e',
    label: 'E2E / visual (Playwright, Cypress, Storybook)',
    hint: 'Playwright "-snapshots" folders, jest-image-snapshot, Cypress snapshots and e2e folders',
    lists: {
      tests: ['**/e2e/**', '**/cypress/e2e/**', '**/playwright/**'],
      snapshots: ['**/*-snapshots/**', '**/__image_snapshots__/**', '**/__diff_output__/**', '**/cypress/snapshots/**'],
    },
  },
];

export const packLayerId = (repo: string, packId: string) => `pack:${repo}:${packId}`;

export function packLayer(repo: string, pack: Pack): Layer {
  return { id: packLayerId(repo, pack.id), label: `Pack ${pack.label}`, kind: 'pack', repo, lists: pack.lists };
}

export function folderLayer(repo: string, prefix: string, listId: string, patterns: string[]): Layer {
  const clean = prefix.replace(/^\/+|\/+$/g, '');
  return { id: `path:${repo}:${clean}`, label: `Folder ${clean}/`, kind: 'path', repo, pathPrefix: clean, lists: { [listId]: patterns } };
}
