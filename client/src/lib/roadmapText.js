/**
 * Plain-text roadmap format — easy to type, paste from a document, or bulk-upload as a .txt file.
 *
 *   Title: Data Analytics for Beginners
 *   Category: Data & AI
 *   Duration: 5 months
 *   Summary: One-line description shown on cards.
 *   Roles: Data Analyst, BI Analyst
 *   Skills: Excel, SQL, Power BI
 *   Keywords: data, analytics, sql
 *   Suitable for: B.Com, BBA, Any graduate
 *   Kit: portfolio | Portfolio with 3 dashboards
 *   Published: yes
 *
 *   ## Spreadsheets & statistics | 4 weeks
 *   - Advanced Excel | Pivot tables, lookups and charts.
 *     + Microsoft Excel help | https://support.microsoft.com/en-us/excel | doc
 *   - Project: sales dashboard | Build and publish a dashboard. | project
 *
 *   ===            (a line of === separates roadmaps in a bulk file)
 *   // lines starting with // are comments
 */
export const CATEGORIES = ['Technology', 'Data & AI', 'Design', 'Management', 'Commerce & Finance', 'Core Engineering', 'Creative & Media', 'Public Sector'];
const RESOURCE_TYPES = ['course', 'doc', 'video', 'practice', 'book', 'community', 'tool'];

export const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
const yes = (v) => /^(y|yes|true|1|published)$/i.test(v.trim());
const FIELD = {
  title: 'title', category: 'category', icon: 'icon', duration: 'duration', summary: 'summary', description: 'description',
  roles: 'roles', skills: 'skills', keywords: 'keywords', 'suitable for': 'suitableFor', suitablefor: 'suitableFor', published: 'isPublished', slug: 'slug',
};

/** Parses ONE roadmap block. Returns { data, errors, warnings }. */
export function parseRoadmapText(text) {
  const errors = [];
  const warnings = [];
  const data = { phases: [], careerKit: [], suitableFor: [], roles: [], skills: [], keywords: [], isPublished: true };
  let phase = null;
  let step = null;
  const usedKeys = new Set();
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const n = idx + 1;
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#') && !line.startsWith('##')) return;

    if (line.startsWith('##')) {
      const body = line.replace(/^##\s*/, '').replace(/^phase\s*\d*\s*[:.-]\s*/i, '');
      const [title, duration = ''] = body.split('|').map((s) => s.trim());
      if (!title || title.length < 2) return errors.push(`Line ${n}: phase needs a title of at least 2 characters (## Phase title | duration)`);
      phase = { title, duration, steps: [] };
      data.phases.push(phase);
      step = null;
      return;
    }

    if (/^[-*•]\s+/.test(line)) {
      if (!phase) return errors.push(`Line ${n}: add a phase heading (## Phase title) before steps`);
      const [title, ...rest] = line.replace(/^[-*•]\s+/, '').split('|').map((s) => s.trim());
      if (!title || title.length < 2) return errors.push(`Line ${n}: step needs a title of at least 2 characters`);
      let description = '';
      let isProject = /^project\b/i.test(title);
      let key = '';
      for (const part of rest) {
        if (/^project$/i.test(part)) isProject = true;
        else if (/^key\s*:/i.test(part)) key = part.replace(/^key\s*:\s*/i, '').toLowerCase();
        else if (!description) description = part;
      }
      key = key && /^[a-z0-9-]{2,80}$/.test(key) ? key : slugify(title) || `step-${n}`;
      let unique = key;
      for (let i = 2; usedKeys.has(unique); i += 1) unique = `${key}-${i}`.slice(0, 80);
      usedKeys.add(unique);
      step = { key: unique, title, description, isProject, resources: [] };
      phase.steps.push(step);
      return;
    }

    if (/^\+\s+/.test(line)) {
      if (!step) return errors.push(`Line ${n}: a resource (+) must come after a step (-)`);
      const [title, url, type = 'course'] = line.replace(/^\+\s+/, '').split('|').map((s) => s.trim());
      if (!title || !url) return errors.push(`Line ${n}: resource format is "+ Title | https://link | type"`);
      if (!/^https?:\/\/\S+$/i.test(url)) return errors.push(`Line ${n}: "${url}" is not a valid http(s) link`);
      const t = type.toLowerCase();
      if (!RESOURCE_TYPES.includes(t)) warnings.push(`Line ${n}: unknown resource type "${type}" — using "course"`);
      step.resources.push({ title, url, type: RESOURCE_TYPES.includes(t) ? t : 'course', free: true });
      return;
    }

    const m = line.match(/^([A-Za-z ]+?)\s*:\s*(.*)$/);
    if (!m) return warnings.push(`Line ${n}: not understood, ignored — "${line.slice(0, 40)}"`);
    const label = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (label === 'kit') {
      const [key, kitLabel] = value.split('|').map((s) => s.trim());
      if (!key || !kitLabel) return errors.push(`Line ${n}: kit format is "Kit: shortKey | Checklist item text"`);
      data.careerKit.push({ key: key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40), label: kitLabel });
      return;
    }
    const field = FIELD[label];
    if (!field) return warnings.push(`Line ${n}: unknown field "${m[1]}" ignored`);
    if (['roles', 'skills', 'keywords', 'suitableFor'].includes(field)) data[field] = list(value);
    else if (field === 'isPublished') data.isPublished = yes(value);
    else data[field] = value;
  });

  if (!data.title) errors.push('Title is required (Title: …)');
  else if (data.title.length < 3) errors.push('Title is too short');
  const cat = CATEGORIES.find((c) => c.toLowerCase() === String(data.category || '').toLowerCase());
  if (!data.category) errors.push(`Category is required — one of: ${CATEGORIES.join(', ')}`);
  else if (!cat) errors.push(`Unknown category "${data.category}" — use one of: ${CATEGORIES.join(', ')}`);
  else data.category = cat;
  if (!data.phases.length) errors.push('Add at least one phase (## Phase title | duration)');
  data.phases.forEach((p) => {
    if (!p.steps.length) errors.push(`Phase "${p.title}" has no steps (- Step title | description)`);
  });
  if (!data.summary) warnings.push('No summary — add "Summary: …" so the roadmap card has a description');
  if (data.slug) data.slug = slugify(data.slug);
  else delete data.slug;
  data.icon ||= 'Compass';
  data.duration ||= '';
  data.summary ||= '';
  data.description ||= '';
  return { data, errors, warnings };
}

/** Splits a bulk file into roadmap blocks (separated by a line of === or ---ROADMAP---) and parses each. */
export function parseBulk(text) {
  const blocks = text
    .split(/^\s*(?:={3,}|-{3,}\s*roadmap\s*-{3,})\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b && b.split(/\r?\n/).some((l) => l.trim() && !l.trim().startsWith('//')));
  return blocks.map((b, i) => ({ index: i + 1, ...parseRoadmapText(b) }));
}

/** Converts a stored roadmap back into editable text (keeps custom step keys so student progress stays linked). */
export function formatRoadmap(r) {
  const out = [`Title: ${r.title}`, `Category: ${r.category}`];
  if (r.slug) out.push(`Slug: ${r.slug}`);
  if (r.icon) out.push(`Icon: ${r.icon}`);
  if (r.duration) out.push(`Duration: ${r.duration}`);
  if (r.summary) out.push(`Summary: ${r.summary}`);
  if (r.description) out.push(`Description: ${r.description.replace(/\n/g, ' ')}`);
  if (r.roles?.length) out.push(`Roles: ${r.roles.join(', ')}`);
  if (r.skills?.length) out.push(`Skills: ${r.skills.join(', ')}`);
  if (r.keywords?.length) out.push(`Keywords: ${r.keywords.join(', ')}`);
  if (r.suitableFor?.length) out.push(`Suitable for: ${r.suitableFor.join(', ')}`);
  (r.careerKit || []).forEach((k) => out.push(`Kit: ${k.key} | ${k.label}`));
  out.push(`Published: ${r.isPublished === false ? 'no' : 'yes'}`);
  for (const p of r.phases || []) {
    out.push('', `## ${p.title}${p.duration ? ` | ${p.duration}` : ''}`);
    for (const s of p.steps) {
      const parts = [s.title];
      const flags = [];
      if (s.description) parts.push(s.description);
      else if (s.isProject && !/^project\b/i.test(s.title)) parts.push('');
      if (s.isProject && !/^project\b/i.test(s.title)) flags.push('project');
      if (s.key !== slugify(s.title)) flags.push(`key:${s.key}`);
      out.push(`- ${[...parts, ...flags].join(' | ')}`);
      (s.resources || []).forEach((res) => out.push(`  + ${res.title} | ${res.url}${res.type && res.type !== 'course' ? ` | ${res.type}` : ''}`));
    }
  }
  return out.join('\n');
}

export const SINGLE_TEMPLATE = `// New roadmap — fill in the fields below. Lines starting with // are ignored.
Title: Data Analytics for Beginners
Category: Data & AI
Duration: 5 months
Summary: Learn Excel, SQL and Power BI and turn raw data into business decisions.
Roles: Data Analyst, BI Analyst
Skills: Excel, SQL, Power BI, Statistics
Keywords: data, analytics, sql, power bi
Suitable for: B.Com, BBA, B.Tech, Any graduate
Kit: portfolio | Portfolio with 3 dashboards
Published: yes

## Spreadsheets & statistics | 4 weeks
- Advanced Excel | Pivot tables, lookups, charts and data cleaning.
  + Microsoft Excel help | https://support.microsoft.com/en-us/excel | doc
- Descriptive statistics | Mean, median, variance, correlation.
  + Khan Academy statistics | https://www.khanacademy.org/math/statistics-probability | course

## SQL & dashboards | 6 weeks
- SQL querying | SELECT, joins, GROUP BY and window functions.
  + SQLBolt | https://sqlbolt.com/ | practice
- Project: sales dashboard | Build a dashboard from a public dataset and publish it. | project
`;

export const BULK_TEMPLATE = `// BULK UPLOAD TEMPLATE — save as .txt and upload. Put a line containing only === between roadmaps.
// Required per roadmap: Title, Category, and at least one "## Phase" with one "- Step".
// Categories: ${CATEGORIES.join(' | ')}
// Resource types: ${RESOURCE_TYPES.join(' | ')}

${SINGLE_TEMPLATE.split('\n').slice(1).join('\n')}
===
Title: Digital Marketing Basics
Category: Management
Duration: 3 months
Summary: SEO, social media and ads for beginners.
Roles: Digital Marketing Executive
Skills: SEO, Google Ads, Content
Published: yes

## Foundations | 3 weeks
- Marketing fundamentals | Funnels, positioning and the customer journey.
  + HubSpot Academy | https://academy.hubspot.com/ | course

## Channels | 6 weeks
- SEO | Keyword research and on-page SEO.
- Project: run a real campaign | Grow a page for a club or local business. | project
`;

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
