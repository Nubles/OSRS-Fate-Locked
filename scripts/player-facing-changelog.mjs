export const CHANGELOG_PATH = 'data/changelog.ts';

const playerFacingFiles = new Set([
  'App.tsx',
  'constants.ts',
  'index.html',
  'index.tsx',
  'styles.css',
  'types.ts',
]);

const playerFacingDirectories = [
  'components/',
  'data/',
  'hooks/',
  'public/',
  'services/',
  'utils/',
  'workers/',
];

const testPath =
  /(?:^|\/)(?:__tests__|fixtures|test|tests)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;

export const normalizeRepositoryPath = (path) =>
  path.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '');

export const isPlayerFacingPath = (path) => {
  const normalizedPath = normalizeRepositoryPath(path);

  if (!normalizedPath || testPath.test(normalizedPath)) return false;
  if (playerFacingFiles.has(normalizedPath)) return true;

  return playerFacingDirectories.some((directory) =>
    normalizedPath.startsWith(directory),
  );
};

export const evaluatePlayerFacingChangelog = (paths) => {
  const normalizedPaths = [...new Set(paths.map(normalizeRepositoryPath))];
  const playerFacingPaths = normalizedPaths
    .filter((path) => path !== CHANGELOG_PATH && isPlayerFacingPath(path))
    .sort((left, right) => left.localeCompare(right));
  const required = playerFacingPaths.length > 0;

  return {
    required,
    satisfied: !required || normalizedPaths.includes(CHANGELOG_PATH),
    playerFacingPaths,
  };
};
