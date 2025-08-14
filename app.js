// CSV → JSON Converter PWA
function detectDelimiter(sample) {
  const candidates = [',',';','\t','|'];
  const counts = candidates.map(d => (sample.match(new RegExp(d === '\t' ? '\\t' : '\\' + d, 'g')) || []).length);
  const max = Math.max(...counts);
  const idx = counts.indexOf(max);
  return max === 0 ? ',' : candidates[idx];
}

function normalizeEOL(text, eolMode) {
  if (eolMode === '\n') return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (eolMode === '\r\n') return text.replace(/\r(?!\n)/g, '\r\n').replace(/(?<!\r)\n/g, '\r\n');
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCSV(text, delimiter, eolMode) {
  const src = normalizeEOL(text, eolMode);
  const D = delimiter === 'auto' ? detectDelimiter(src.slice(0, 2000)) : (delimiter === '\\t' ? '\t' : delimiter);
  const rows = [];
  let field = '', row = [];
  let i = 0, inQuotes = false;

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < src.length && src[i+1] === '"') {
          field += '"'; i += 2; continue;
        } else {
          inQuotes = false; i++; continue;
        }
      } else {
        field += ch; i++; continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === D) { row.push(field); field = ''; i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++; continue;
    }
  }
  row.push(field); rows.push(row);
  if (rows.length && rows[rows.length-1].length === 1 && rows[rows.length-1][0] === '') {
    rows.pop();
  }
  return { rows, delimiter: D };
}

function rowsToJSON(rows, hasHeader, emptyPolicy) {
  const out = [];
  if (!rows.length) return out;
  if (hasHeader) {
    const header = rows[0];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) {
        const key = String(header[c] ?? `col_${c+1}`);
        const val = rows[r][c] ?? '';
        if (val === '') {
          if (emptyPolicy === 'empty') obj[key] = '';
          else if (emptyPolicy === 'null') obj[key] = null;
          else if (emptyPolicy === 'omit') { /* skip */ }
        } else {
          obj[key] = val;
        }
      }
      out.push(obj);
    }
  } else {
    for (let r = 0; r < rows.length; r++) {
      const arr = [];
      for (let c = 0; c < rows[r].length; c++) {
        const val = rows[r][c] ?? '';
        if (val === '') {
          if (emptyPolicy === 'empty') arr.push('');
          else if (emptyPolicy === 'null') arr.push(null);
          else if (emptyPolicy === 'omit') { /* skip */ }
        } else {
          arr.push(val);
        }
      }
      out.push(arr);
    }
  }
  return out;
}

function formatJSON(value, mode='pretty') {
  return mode === 'min' ? JSON.stringify(value) : JSON.stringify(value, null, 2);
}

function download(filename, text) {
  const blob = new Blob([text], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const els = {
  file: document.getElementById('file'),
  csv: document.getElementById('csv'),
  hasHeader: document.getElementById('hasHeader'),
  delimiter: document.getElementById('delimiter'),
  eol: document.getElementById('eol'),
  emptyPolicy: document.getElementById('emptyPolicy'),
  convert: document.getElementById('convert'),
  copyJson: document.getElementById('copyJson'),
  downloadJson: document.getElementById('downloadJson'),
  beautify: document.getElementById('beautify'),
  minify: document.getElementById('minify'),
  output: document.getElementById('jsonOutput'),
  sample: document.getElementById('sample'),
  clear: document.getElementById('clear'),
};

let lastJSON = null;
let jsonMode = 'pretty';

function setActionsEnabled(ok) {
  els.copyJson.disabled = !ok;
  els.downloadJson.disabled = !ok;
  els.beautify.disabled = !ok;
  els.minify.disabled = !ok;
}

els.file.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  els.csv.value = text;
});

els.sample.addEventListener('click', () => {
  els.csv.value = "name,age,city\n\"Alice\",30,Chennai\n\"Bob\",27,\"Bengaluru\"\n\"Chandru \"\"CJ\"\"\",33,\"Hyderabad\"";
  els.csv.focus();
});

els.clear.addEventListener('click', () => {
  els.csv.value = '';
  els.output.textContent = '';
  lastJSON = null; setActionsEnabled(false);
});

els.convert.addEventListener('click', () => {
  try {
    const raw = els.csv.value;
    if (!raw.trim()) {
      els.output.textContent = 'Paste or upload CSV first.';
      setActionsEnabled(false);
      return;
    }
    const { rows, delimiter } = parseCSV(raw, els.delimiter.value, els.eol.value);
    const data = rowsToJSON(rows, els.hasHeader.checked, els.emptyPolicy.value);
    lastJSON = data;
    jsonMode = 'pretty';
    const formatted = formatJSON(data, 'pretty');
    els.output.textContent = formatted;
    setActionsEnabled(true);
  } catch (err) {
    console.error(err);
    els.output.textContent = 'Conversion failed: ' + (err?.message || err);
    setActionsEnabled(false);
  }
});

els.copyJson.addEventListener('click', async () => {
  if (!lastJSON) return;
  const text = formatJSON(lastJSON, jsonMode === 'min' ? 'min' : 'pretty');
  await navigator.clipboard.writeText(text);
  els.copyJson.textContent = 'Copied!';
  setTimeout(() => els.copyJson.textContent = 'Copy JSON', 1200);
});

els.downloadJson.addEventListener('click', () => {
  if (!lastJSON) return;
  const text = formatJSON(lastJSON, jsonMode === 'min' ? 'min' : 'pretty');
  download('converted.json', text);
});

els.beautify.addEventListener('click', () => {
  if (!lastJSON) return;
  jsonMode = 'pretty';
  els.output.textContent = formatJSON(lastJSON, 'pretty');
});

els.minify.addEventListener('click', () => {
  if (!lastJSON) return;
  jsonMode = 'min';
  els.output.textContent = formatJSON(lastJSON, 'min');
});
