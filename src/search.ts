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

// New utility function to manage languages
function getEffectiveLanguages(): string[] {
  const langArg = process.argv.find(arg => arg.startsWith('--langcode='));
  const userLanguages = langArg?.split('=')[1]?.split(',') || [];

  // Dictionary of supported languages with aliases
  const SUPPORTED_LANGS = new Map<string, string>([
    ['ts', 'typescript'],
    ['typescript', 'typescript'],
    ['js', 'javascript'],
    ['javascript', 'javascript'],
    ['py', 'python'],
    ['python', 'python'],
    ['sh', 'shell'],
    ['shell', 'shell'],
    ['html', 'HTML'],
  ]);

  // Filtering and normalization
  const validLanguages = Array.from(new Set(
    userLanguages
      .map(lang => SUPPORTED_LANGS.get(lang.trim().toLowerCase()))
      .filter(Boolean)
  )) as string[];

  // Fallback if no valid language
  return validLanguages.length > 0 ? validLanguages : ['typescript', 'javascript', 'HTML'];
}

// Updated main function
export async function searchGithubRepos(query: string, token?: string): Promise<SearchResult[]> {
  if (!token) {
    throw new Error('GitHub token is required for search functionality');
  }

  const languages = getEffectiveLanguages();
  const octokit = new Octokit({ auth: token });

  try {
    // Build the query with language filter using GitHub search syntax
    const languageFilter = languages.map(lang => `language:${lang.toLowerCase()}`).join('+');
    const q = `${query}+${languageFilter}`.trim();
    
    const { data } = await octokit.rest.search.repos({
      q,
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

// Optional validation function
export function validateLanguages() {
  const langArg = process.argv.find(arg => arg.startsWith('--langcode='));
  if (!langArg) return;

  const input = langArg.split('=')[1]?.split(',') || [];
  const valid = getEffectiveLanguages();
  
  const invalid = input.filter(lang => 
    !valid.includes(lang.trim().toLowerCase())
  );

  if (invalid.length > 0) {
    console.warn(`Unsupported languages ignored: ${invalid.join(', ')}`);
  }
}

// Validation on load (optional)
validateLanguages();
