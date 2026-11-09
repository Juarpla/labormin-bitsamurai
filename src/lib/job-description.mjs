const tools = ['AutoCAD', 'MinePlan 3D', 'MinePlan', 'MineOperate OpPro', 'MS Office', 'Excel', 'Comet', 'Deswik', 'Surpac', 'Power BI', 'SAP'];
const toolPattern = new RegExp('\\b(?:' + tools.join('|') + ')\\b', 'gi');

export function mentionedTools(text) {
  const matches = new Set([...text.matchAll(toolPattern)].map(match => match[0].toLowerCase()));
  return tools.filter(tool => matches.has(tool.toLowerCase()));
}

export function requirementItems(blocks) {
  return blocks.filter(block => !/^(?:requiere|requisitos)\s*:?\s*$/i.test(block.trim())).flatMap(block => {
    if (block.length < 180) return [block];
    // Start a new bullet at the next distinct skill, outside parenthetical details.
    const starts = /^(?:diseños? de|conocimientos? en|evaluaci[oó]n de|manejo de|dominio de|licencia de|disponibilidad para)\b/i;
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '(') depth++;
      if (block[i] === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && /[,;]/.test(block[i]) && starts.test(block.slice(i + 1).trimStart())) {
        parts.push(block.slice(start, i).trim());
        start = i + 1;
      }
    }
    return [...parts, block.slice(start).trim()];
  });
}

export function requirementEmphasis(text) {
  const key = /\b(?:\d+\s*(?:años?|mes(?:es)?)\s+(?:de\s+)?experiencia|licencia de conducir|ingl[eé]s(?:\s+(?:b[aá]sico|intermedio|avanzado))?|obligatori[oa]|deseable|planes de minado)\b/gi;
  const ranges = [...text.matchAll(key), ...text.matchAll(toolPattern)].sort((a, b) => a.index - b.index);
  const result = [];
  let index = 0;
  for (const match of ranges) {
    if (match.index < index) continue;
    result.push({ text: text.slice(index, match.index), strong: false }, { text: match[0], strong: true });
    index = match.index + match[0].length;
  }
  return [...result, { text: text.slice(index), strong: false }];
}
