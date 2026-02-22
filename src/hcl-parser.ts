/**
 * Extracts GitLab group team names from a Terraform pr.tfvars file.
 * Parses only the `groups = [...]` block and extracts `name = "..."` values within it.
 */
export function parseTeamNames(content: string): string[] {
  const groupsMatch = content.match(/\bgroups\s*=\s*\[([\s\S]*?)\n\]/);
  if (!groupsMatch) return [];

  const block = groupsMatch[1];
  const names: string[] = [];
  const nameRegex = /^\s*\{?\s*name\s*=\s*"([^"]+)"/gm;
  let match: RegExpExecArray | null;

  while ((match = nameRegex.exec(block)) !== null) {
    names.push(match[1]);
  }

  return names;
}
