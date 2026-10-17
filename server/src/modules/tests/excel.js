import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';

const MAX_ROWS = 500;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Flattens any ExcelJS cell value (rich text, formula, hyperlink…) to plain text. */
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

const HEADERS = {
  question: ['question', 'questions', 'q', 'question text'],
  a: ['option a', 'a', 'option 1', 'option1', 'choice a'],
  b: ['option b', 'b', 'option 2', 'option2', 'choice b'],
  c: ['option c', 'c', 'option 3', 'option3', 'choice c'],
  d: ['option d', 'd', 'option 4', 'option4', 'choice d'],
  e: ['option e', 'e', 'option 5'],
  f: ['option f', 'f', 'option 6'],
  correct: ['correct', 'correct answer', 'answer', 'right answer', 'correct option'],
  explanation: ['explanation', 'solution', 'reason'],
  topic: ['topic', 'subject', 'category', 'subtopic'],
  marks: ['marks', 'mark', 'points', 'score'],
};

/** Parses an .xlsx or .csv buffer into questions + row-level errors. */
export async function parseQuestionFile(buffer, format = 'xlsx') {
  const wb = new ExcelJS.Workbook();
  try {
    if (format === 'csv') await wb.csv.read(Readable.from(buffer));
    else await wb.xlsx.load(buffer);
  } catch {
    return { questions: [], errors: [{ row: 0, message: 'This file could not be read. Please use the template (.xlsx or .csv).' }] };
  }
  const sheet = wb.getWorksheet('Questions') || wb.worksheets[0];
  if (!sheet) return { questions: [], errors: [{ row: 0, message: 'The file has no sheets.' }] };

  // Locate the header row (first row containing a "question" header) and map columns.
  let headerRow = 0;
  const col = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r += 1) {
    const found = {};
    sheet.getRow(r).eachCell((cell, c) => {
      const h = cellText(cell.value).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\*/g, '').trim(); // ignore "(optional)" and required-stars
      for (const [key, names] of Object.entries(HEADERS)) if (names.includes(h) && found[key] === undefined) found[key] = c;
    });
    if (found.question && found.a && found.b && found.correct) {
      headerRow = r;
      Object.assign(col, found);
      break;
    }
  }
  if (!headerRow) {
    return { questions: [], errors: [{ row: 0, message: 'Header row not found. Columns needed: Question, Option A, Option B, (Option C, Option D), Correct.' }] };
  }

  const questions = [];
  const errors = [];
  const seen = new Set();
  const optionCols = ['a', 'b', 'c', 'd', 'e', 'f'].filter((k) => col[k]);
  const last = Math.min(sheet.rowCount, headerRow + MAX_ROWS + 1);
  if (sheet.rowCount > headerRow + MAX_ROWS) errors.push({ row: 0, message: `Only the first ${MAX_ROWS} questions are read.` });

  for (let r = headerRow + 1; r <= last; r += 1) {
    const row = sheet.getRow(r);
    const text = cellText(row.getCell(col.question).value);
    const options = optionCols.map((k) => cellText(row.getCell(col[k]).value));
    if (!text && options.every((o) => !o)) continue; // blank row
    const fail = (message) => errors.push({ row: r, message });
    if (text.length < 5) { fail('Question text is missing or too short.'); continue; }
    const filled = options.filter(Boolean);
    if (filled.length < 2) { fail('At least two options are needed.'); continue; }
    if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) { fail('Options must be different from each other.'); continue; }

    const raw = cellText(row.getCell(col.correct).value);
    let idx = -1;
    if (/^[A-Fa-f]$/.test(raw)) idx = raw.toUpperCase().charCodeAt(0) - 65;
    else if (/^[1-6]$/.test(raw)) idx = Number(raw) - 1;
    else if (raw) idx = options.findIndex((o) => o && o.toLowerCase() === raw.toLowerCase());
    if (idx < 0 || !options[idx]) { fail(`Correct answer "${raw || 'blank'}" must be A–${LETTERS[filled.length - 1]} (or 1–${filled.length}) and match a filled option.`); continue; }

    // Compact options, remembering where the correct one moved.
    const compact = [];
    let correct = 0;
    options.forEach((o, i) => {
      if (!o) return;
      if (i === idx) correct = compact.length;
      compact.push(o);
    });
    const dedupe = text.toLowerCase();
    if (seen.has(dedupe)) { fail('Duplicate question — skipped.'); continue; }
    seen.add(dedupe);
    const marks = Number(cellText(col.marks ? row.getCell(col.marks).value : '')) || 1;
    questions.push({
      text: text.slice(0, 1000),
      options: compact.map((o) => o.slice(0, 400)),
      correct,
      explanation: col.explanation ? cellText(row.getCell(col.explanation).value).slice(0, 1000) : '',
      topic: col.topic ? cellText(row.getCell(col.topic).value).slice(0, 120) : '',
      marks: Math.min(20, Math.max(0.25, marks)),
    });
  }
  if (!questions.length && !errors.length) errors.push({ row: 0, message: 'No questions found under the header row.' });
  return { questions, errors };
}

/** Builds the downloadable .xlsx template with sample rows and instructions. */
export async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CareerSaathi';
  const ws = wb.addWorksheet('Questions', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Question', key: 'q', width: 60 },
    { header: 'Option A', key: 'a', width: 28 },
    { header: 'Option B', key: 'b', width: 28 },
    { header: 'Option C', key: 'c', width: 28 },
    { header: 'Option D', key: 'd', width: 28 },
    { header: 'Correct', key: 'correct', width: 10 },
    { header: 'Explanation (optional)', key: 'e', width: 48 },
    { header: 'Topic (optional)', key: 't', width: 20 },
    { header: 'Marks (optional)', key: 'm', width: 12 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7C77' } };
  ws.addRows([
    { q: 'Which SQL clause is used to filter rows before grouping?', a: 'HAVING', b: 'WHERE', c: 'ORDER BY', d: 'LIMIT', correct: 'B', e: 'WHERE filters rows before GROUP BY; HAVING filters groups afterwards.', t: 'SQL', m: 1 },
    { q: 'Which HTTP method is idempotent?', a: 'POST', b: 'PATCH', c: 'PUT', d: 'CONNECT', correct: 'C', e: 'Repeating the same PUT request leaves the resource in the same state.', t: 'Web', m: 1 },
    { q: 'What is the time complexity of binary search on a sorted array?', a: 'O(n)', b: 'O(log n)', c: 'O(n log n)', d: 'O(1)', correct: 'B', e: '', t: 'DSA', m: 2 },
  ]);
  const info = wb.addWorksheet('Instructions');
  info.columns = [{ width: 110 }];
  [
    'HOW TO FILL THIS TEMPLATE',
    '1. Keep the header row on the "Questions" sheet exactly as it is. Add one question per row below it (up to 500).',
    '2. Provide Option A and Option B at minimum; Options C and D are recommended. Up to 6 options (E, F) are supported by adding those columns.',
    '3. "Correct" is the letter of the right option (A, B, C or D) — numbers 1–4 or the exact option text also work.',
    '4. Explanation, Topic and Marks are optional. Marks default to 1. Topic helps analyse which subjects students find hard.',
    '5. Save as .xlsx (or .csv) and upload it in Admin → Tests. Rows with problems are listed before anything is saved.',
    '6. Delete the 3 sample rows before uploading, or keep them if you want them in the test.',
  ].forEach((line, i) => {
    const row = info.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 13 };
    row.alignment = { wrapText: true };
  });
  return wb.xlsx.writeBuffer();
}
