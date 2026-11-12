import { createGitHubPublicationHost } from '@kubohiroya/turbowarp-plus-editor-git/github-publication-host';
import { createPullRequestQueue, validatePublicationIntent } from '@kubohiroya/turbowarp-plus-editor-git/pull-request-queue';
import { GitHubPublication as Publication } from './src/GitHubPublication.ts';
import worker from './src/index.ts';

export { GitSession } from './src/index.ts';
export default worker;

export class GitHubPublication extends Publication {
  constructor(state, env) {
    super(state, env, {
      createHost: createGitHubPublicationHost,
      createQueue: createPullRequestQueue,
      validateIntent: validatePublicationIntent,
    });
  }
}
