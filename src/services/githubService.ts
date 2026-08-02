import { Octokit } from '@octokit/rest';
import { DiffLocation } from '../analyzer/diffMapper';

export interface GitHubWebhookPayload {
  action: string;
  number: number;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  pull_request: {
    number: number;
    head: {
      sha: string;
    };
  };
  simulated_diffs?: DiffLocation[];
}

export function parseGitHubWebhookPayload(payload: any): {
  action: string;
  repoName: string;
  repoOwner: string;
  prNumber: number;
  diffs: DiffLocation[];
} {
  const action = payload.action || 'opened';
  const repoName = payload.repository?.name || 'payment-service';
  const repoOwner = payload.repository?.owner?.login || 'codexa-org';
  const prNumber = payload.number || payload.pull_request?.number || 42;

  const diffs: DiffLocation[] = payload.simulated_diffs || [
    {
      repoName: repoName,
      filePath: 'src/routes.ts',
      startLine: 2,
      endLine: 5
    }
  ];

  return { action, repoName, repoOwner, prNumber, diffs };
}

export async function postGitHubPRComment(
  owner: string,
  repo: string,
  prNumber: number,
  markdown: string,
  githubToken?: string
): Promise<boolean> {
  console.log(`[GitHub API Service]: Dispatching PR Comment to https://github.com/${owner}/${repo}/pull/${prNumber}...`);

  if (githubToken) {
    try {
      const octokit = new Octokit({ auth: githubToken });
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: markdown
      });
      console.log(`[GitHub API Service]: Successfully posted comment on PR #${prNumber} via Octokit!`);
      return true;
    } catch (err: any) {
      console.error(`[GitHub API Error]:`, err.message);
      return false;
    }
  } else {
    // Development / Dry-Run Mode
    console.log(`[GitHub API Service (Dry-Run Mode)]: Risk comment generated successfully for PR #${prNumber}! (No GITHUB_TOKEN set, dry-run mode active)`);
    return true;
  }
}
