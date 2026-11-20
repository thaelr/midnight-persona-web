import type {WebCharacter} from './types';

/**
 * Author descriptions start with their own `Name, age.` line. The card heading
 * already prints `Name, age`, so only that lead is dropped. The name is matched
 * loosely because it is localized differently from `character.name`; the age
 * must equal the known `age` and is never read back from the text. The rest of
 * the description, including line breaks, is kept verbatim.
 */
export function cardDescription(character: WebCharacter, age?: number) {
  const text = character.description;
  if (!age) return text;
  const lead = new RegExp(`^[ \\t]*[^\\n,،]+[,،][ \\t]*${age}(?!\\d)[ \\t]*[.!][ \\t]*`, 'u');
  const match = lead.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  return rest.trim() ? rest : text;
}
