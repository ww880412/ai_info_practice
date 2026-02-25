/**
 * GitHub content parser - fetches README from GitHub repos.
 */
import type { ParseMetadata } from "./strategy";

interface GitHubParseResult {
  title: string;
  content: string;
  sourceType: "GITHUB";
  metadata?: ParseMetadata;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  return { owner: match[1], repo: match[2].replace(/\.git$/, "").split(/[?#]/)[0] };
}

export function isGitHubUrl(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+/.test(url);
}

export async function parseGitHub(url: string): Promise<GitHubParseResult> {
  const { owner, repo } = parseGitHubUrl(url);

  // Fetch repo info for title
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!repoRes.ok) {
    throw new Error(`GitHub API error: ${repoRes.status} ${repoRes.statusText}`);
  }

  const repoData = await repoRes.json();
  const title = repoData.full_name + (repoData.description ? ` - ${repoData.description}` : "");

  // Extract metadata
  const metadata: ParseMetadata = {};
  if (repoData.stargazers_count !== undefined) {
    metadata.stars = repoData.stargazers_count;
  }
  if (repoData.language) {
    metadata.language = repoData.language;
  }
  if (Array.isArray(repoData.topics) && repoData.topics.length > 0) {
    metadata.topics = repoData.topics;
  }

  // Fetch README
  const readmeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    {
      headers: {
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  let content = "";
  if (readmeRes.ok) {
    content = await readmeRes.text();
  } else {
    content = `Repository: ${repoData.full_name}\nDescription: ${repoData.description || "N/A"}\nStars: ${repoData.stargazers_count}\nLanguage: ${repoData.language || "N/A"}`;
  }

  return { title, content, sourceType: "GITHUB", metadata };
}
