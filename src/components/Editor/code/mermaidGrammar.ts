import type { HLJSApi, Language } from 'highlight.js'

/** highlight.js grammar for Mermaid diagram source (not shipped by highlight.js). */
export function mermaidGrammar(hljs: HLJSApi): Language {
  return {
    name: 'Mermaid',
    aliases: ['mmd'],
    case_insensitive: false,
    contains: [
      { scope: 'comment', begin: /%%(?!\{)/, end: /$/ },
      { scope: 'meta', begin: /%%\{/, end: /\}%%/ },
      {
        // Diagram type on the first line ("flowchart LR", "sequenceDiagram", …).
        scope: 'keyword',
        begin:
          /^\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|kanban|architecture(?:-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|radar(?:-beta)?|treemap(?:-beta)?)\b/,
        starts: { scope: 'type', begin: /\s+(?:TB|TD|BT|RL|LR)\b/, end: /$/, endsParent: false, returnEnd: true },
      },
      {
        scope: 'built_in',
        begin:
          /\b(?:subgraph|end|direction|participant|actor|activate|deactivate|loop|alt|else|opt|par|and|critical|break|rect|note|over|left of|right of|autonumber|class|classDef|style|linkStyle|click|state|section|title|dateFormat|axisFormat|excludes|accTitle|accDescr|commit|branch|checkout|merge|cherry-pick|showData)\b/,
      },
      // Arrows and links: -->, ---, -.->, ==>, ->>, -x, --o, <|--, *--, o--, ..>, |label|
      { scope: 'operator', begin: /<?(?:-{2,}|={2,}|-\.+-?|\.{2,})(?:>>?|x|o|\|>)?|<\|--|\*--|o--|->>?|-[x)]|\+\+|::/ },
      { scope: 'string', begin: /\|/, end: /\|/ },
      hljs.QUOTE_STRING_MODE,
      // Node shapes: A[text] B(text) C{text} D((text)) E>text]
      { scope: 'string', begin: /\[\[?|\(\(?\(?|\{\{?|>(?=[^\s>])/, end: /\]\]?|\)?\)?\)|\}\}?/, excludeBegin: true, excludeEnd: true, contains: [hljs.QUOTE_STRING_MODE] },
      { scope: 'number', begin: /\b\d+(?:\.\d+)?%?\b/ },
      { scope: 'variable', begin: /\b[A-Za-z_][\w-]*(?=\s*(?:[[({>]|-->|---|==>|-\.|:::))/ },
      { scope: 'attr', begin: /:::\s*[\w-]+/ },
    ],
  }
}
