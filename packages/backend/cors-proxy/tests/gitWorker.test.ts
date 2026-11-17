import { afterEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({
  git: vi.fn(async () => new Response('git')),
  github: vi.fn(async () => new Response('github')),
}));

vi.mock('../src/handleGitProxy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/handleGitProxy')>()),
  handleGitProxy: handlers.git,
}));
vi.mock('../src/handleGitHubApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/handleGitHubApi')>()),
  handleGitHubApi: handlers.github,
}));

const { default: gitWorker } = await import('../src/gitWorker');
const { default: genericWorker } = await import('../src/worker');

const gitPath = 'https://worker.test/v1/git/owner/repo.git/info/refs?service=git-upload-pack';
const githubPath = 'https://worker.test/v1/github/owner/repo/pulls';
const origin = { Origin: 'https://editor.test' };

afterEach(() => vi.clearAllMocks());

describe('Git Worker', () => {
  it('routes the Git and GitHub API paths to their handlers', async () => {
    expect(await (await gitWorker.fetch(new Request(gitPath), {})).text()).toBe('git');
    expect(await (await gitWorker.fetch(new Request(githubPath), {})).text()).toBe('github');
  });

  it('does not serve the generic proxy', async () => {
    const response = await gitWorker.fetch(
      new Request('https://worker.test/?url=https%3A%2F%2Fgithub.com%2F', { headers: origin }),
      { ALLOWED_ORIGINS: '*', ALLOWED_TARGET_LIST: 'https://github.com' }
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(handlers.git).not.toHaveBeenCalled();
    expect(handlers.github).not.toHaveBeenCalled();
  });
});

describe('generic proxy Worker', () => {
  it('no longer serves the Git and GitHub API paths', async () => {
    for (const path of [gitPath, githubPath]) {
      const response = await genericWorker.fetch(new Request(path, { headers: origin }), {
        ALLOWED_ORIGINS: '*',
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing url parameter');
    }
    expect(handlers.git).not.toHaveBeenCalled();
    expect(handlers.github).not.toHaveBeenCalled();
  });
});
