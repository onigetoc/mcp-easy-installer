import { Octokit } from '@octokit/rest';

interface SearchResult {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

interface GithubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

export async function searchGithubRepos(query: string, token?: string): Promise<SearchResult[]> {
  if (!token) {
    throw new Error('GitHub token is required for search functionality');
  }

  const octokit = new Octokit({
    auth: token
  });

  try {
    const { data } = await octokit.search.repos({
      q: query,
      sort: 'stars',
      order: 'desc',
      per_page: 10
    });

    return data.items.map((repo: GithubRepo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count
    }));
  } catch (error) {
    console.error('GitHub search error:', error);
    throw new Error('Failed to search GitHub repositories');
  }
}