import sanitizeHtml from 'sanitize-html';

export function editorialHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'h2', 'h3', 'h4', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote',
      'figure', 'figcaption', 'svg', 'use', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'dl', 'dt', 'dd', 'code', 'pre', 'hr', 'br', 'time',
    ],
    allowedAttributes: {
      'h2': ['id'], 'h3': ['id'], 'h4': ['id'],
      'a': ['href', 'title'], 'ol': ['start'],
      'figure': ['class', 'aria-hidden'],
      'svg': ['viewBox', 'focusable', 'aria-hidden'],
      'use': ['href'], 'th': ['scope'], 'time': ['datetime'],
    },
    allowedClasses: { figure: ['editorial-figure'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    parser: { lowerCaseAttributeNames: false },
    transformTags: {
      use: (tagName, attributes) => ({
        tagName,
        attribs: /^\/icons\/guide-illustrations\.svg#[\w-]+$/.test(attributes.href ?? '')
          ? { href: attributes.href } : {},
      }),
    },
  });
}
