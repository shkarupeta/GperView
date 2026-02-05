const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const rulesList = document.getElementById('rulesList');
const addRuleBtn = document.getElementById('addRuleBtn');
const pageSizeInput = document.getElementById('pageSize');
const jumpToInput = document.getElementById('jumpTo');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const totalLinesEl = document.getElementById('totalLines');
const filteredLinesEl = document.getElementById('filteredLines');
const pageInfoEl = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebarEl = document.getElementById('sidebar');
const copyBtn = document.getElementById('copyBtn');

let allLines = [];
let filtered = [];
let currentPage = 1;
let isSidebarCollapsed = false;
const MAX_RULES = 8;
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const applyFiltersDebounced = debounce(() => {
  if (allLines.length > 0) {
    applyFilters();
  }
}, 400);

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, (ch) => map[ch]);
}

function buildRegex(pattern, isRegex, flags) {
  if (!pattern) return null;
  try {
    if (isRegex) {
      return new RegExp(pattern, flags);
    }
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, flags);
  } catch (err) {
    statusEl.textContent = `Regex error: ${err.message}`;
    statusEl.classList.add('error');
    return null;
  }
}

function buildRuleTest(rule) {
  const value = rule.value.trim();
  if (!value) return null;
  const testFlags = rule.caseSensitive ? '' : 'i';

  if (rule.type === 'regex') {
    const re = buildRegex(value, true, testFlags);
    if (!re) return null;
    return (line) => re.test(line);
  }

  const escaped = value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  if (rule.type === 'starts') {
    const re = new RegExp(`^${escaped}`, testFlags);
    return (line) => re.test(line);
  }
  if (rule.type === 'ends') {
    const re = new RegExp(`${escaped}$`, testFlags);
    return (line) => re.test(line);
  }

  const re = new RegExp(escaped, testFlags);
  if (rule.type === 'exclude') {
    return (line) => !re.test(line);
  }
  return (line) => re.test(line);
}

function buildHighlightRegex(rules) {
  const parts = [];
  let flags = 'g';
  for (const rule of rules) {
    const value = rule.value.trim();
    if (!value) continue;
    if (rule.type === 'exclude') continue;
    if (!rule.caseSensitive) flags = 'gi';
    if (rule.type === 'regex') {
      parts.push(`(${value})`);
      continue;
    }
    const escaped = value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    if (rule.type === 'starts') {
      parts.push(`(^${escaped})`);
    } else if (rule.type === 'ends') {
      parts.push(`(${escaped}$)`);
    } else {
      parts.push(`(${escaped})`);
    }
  }
  if (!parts.length) return null;
  try {
    return new RegExp(parts.join('|'), flags);
  } catch (err) {
    statusEl.textContent = `Regex error: ${err.message}`;
    statusEl.classList.add('error');
    return null;
  }
}

function highlightLine(line, includeRegex) {
  if (!includeRegex) return escapeHtml(line);
  const re = new RegExp(includeRegex.source, includeRegex.flags);
  let result = '';
  let lastIndex = 0;
  for (const match of line.matchAll(re)) {
    if (match[0] === '') break;
    const start = match.index ?? 0;
    const end = start + match[0].length;
    result += escapeHtml(line.slice(lastIndex, start));
    result += `<mark>${escapeHtml(line.slice(start, end))}</mark>`;
    lastIndex = end;
  }
  result += escapeHtml(line.slice(lastIndex));
  return result;
}

function decorateLine(html) {
  let output = html;
  output = output.replace(
    /(\b\d{4}-\d{2}-\d{2}\b)/g,
    '<span class="hl-date">$1</span>'
  );
  output = output.replace(
    /(\b\d{2}:\d{2}:\d{2}(?:[.,]\d{3})?\b)/g,
    '<span class="hl-time">$1</span>'
  );
  output = output.replace(/\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL)\b/g, (full, level) => {
    return `<span class="hl-level level-${level.toLowerCase()}">${level}</span>`;
  });
  return output;
}

function getUppercaseLevel(line) {
  const match = line.match(/\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL)\b/);
  return match ? match[1] : null;
}

function applyFilters() {
  statusEl.classList.remove('error');
  const rules = getRules();
  const ruleTests = rules
    .map((rule) => ({ rule, test: buildRuleTest(rule) }))
    .filter((entry) => entry.test);
  if (rules.length && !ruleTests.length) {
    renderPage(null);
    return;
  }
  const highlightRegex = buildHighlightRegex(rules);

  filtered = [];
  for (let i = 0; i < allLines.length; i += 1) {
    const line = allLines[i];
    if (!ruleTests.length) {
      filtered.push({ index: i + 1, text: line });
      continue;
    }
    const includeRules = ruleTests.filter(({ rule }) => rule.type !== 'exclude');
    const excludeRules = ruleTests.filter(({ rule }) => rule.type === 'exclude');

    let includeMatch = true;
    if (includeRules.length) {
      includeMatch = null;
      for (const { rule, test } of includeRules) {
        const passed = test(line);
        if (includeMatch === null) {
          includeMatch = passed;
        } else if (rule.join === 'or') {
          includeMatch = includeMatch || passed;
        } else {
          includeMatch = includeMatch && passed;
        }
      }
    }

    let excludeMatch = true;
    for (const { test } of excludeRules) {
      if (!test(line)) {
        excludeMatch = false;
        break;
      }
    }

    if (includeMatch && excludeMatch) {
      filtered.push({ index: i + 1, text: line });
    }
  }

  filteredLinesEl.textContent = filtered.length.toString();
  totalLinesEl.textContent = allLines.length.toString();

  currentPage = 1;
  renderPage(highlightRegex);
}

function getPagination() {
  if (allLines.length <= 2000) {
    return { pageSize: filtered.length || 1, totalPages: 1 };
  }
  const raw = Number(pageSizeInput.value);
  const pageSize = Number.isFinite(raw) && raw > 0 ? raw : 200;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return { pageSize, totalPages };
}

function renderPage(includeRegex) {
  if (allLines.length === 0) {
    outputEl.innerHTML = '<div class="empty">Завантаж файл, щоб почати</div>';
    pageInfoEl.textContent = '0 / 0';
    return;
  }

  const { pageSize, totalPages } = getPagination();
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = allLines.length > 2000 ? start + pageSize : filtered.length;
  const pageLines = filtered.slice(start, end);

  const html = pageLines
    .map((item, idx) => {
      const displayIndex = start + idx + 1;
      const highlighted = highlightLine(item.text, includeRegex);
      const decorated = decorateLine(highlighted);
      const level = getUppercaseLevel(item.text);
      const glowClass = level ? ` level-${level.toLowerCase()}-glow` : '';
      return `<div class="line${glowClass}"><span class="line-number file">${item.index}</span><span class="line-number display">${displayIndex}</span><span class="line-text">${decorated}</span></div>`;
    })
    .join('');

  outputEl.innerHTML = html || '<div class="empty">Немає збігів</div>';
  pageInfoEl.textContent = `${currentPage} / ${totalPages}`;
}

function handleFile(file) {
  if (!file) return;
  statusEl.textContent = `Читаю файл: ${file.name}...`;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result || '';
    allLines = text.toString().split(/\r?\n/);
    statusEl.textContent = `Завантажено ${file.name}. Рядків: ${allLines.length}`;
    applyFilters();
  };
  reader.onerror = () => {
    statusEl.textContent = 'Помилка читання файлу';
    statusEl.classList.add('error');
  };
  reader.readAsText(file);
}

fileInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  handleFile(file);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  handleFile(file);
});

jumpToInput.addEventListener('change', () => {
  const value = Number(jumpToInput.value);
  if (!Number.isFinite(value)) return;
  currentPage = value;
  renderPage(buildHighlightRegex(getRules()));
});

prevBtn.addEventListener('click', () => {
  currentPage -= 1;
  renderPage(buildHighlightRegex(getRules()));
});

nextBtn.addEventListener('click', () => {
  currentPage += 1;
  renderPage(buildHighlightRegex(getRules()));
});

outputEl.innerHTML = '<div class="empty">Завантаж файл, щоб почати</div>';

function getRules() {
  return Array.from(rulesList.querySelectorAll('[data-rule]'))
    .map((row) => ({
      join: row.querySelector('.rule-join')?.value || 'and',
      type: row.querySelector('.rule-type')?.value || 'include',
      value: row.querySelector('.rule-value')?.value || '',
      caseSensitive: row.querySelector('.rule-case-toggle')?.checked || false,
    }))
    .filter((rule) => rule.value.trim() !== '');
}

function addRuleRow() {
  const rows = rulesList.querySelectorAll('[data-rule]').length;
  if (rows >= MAX_RULES) {
    statusEl.textContent = `Досягнуто ліміт: ${MAX_RULES} правил`;
    statusEl.classList.add('error');
    return;
  }
  statusEl.classList.remove('error');
  const template = rulesList.querySelector('[data-rule]');
  const clone = template.cloneNode(true);
  clone.querySelector('.rule-join').value = 'and';
  clone.querySelector('.rule-value').value = '';
  clone.querySelector('.rule-case-toggle').checked = false;
  rulesList.appendChild(clone);
  attachRuleHandlers(clone);
  updateJoinSelectors();
}

function removeRuleRow(row) {
  const rows = rulesList.querySelectorAll('[data-rule]');
  if (rows.length <= 1) {
    row.querySelector('.rule-value').value = '';
    row.querySelector('.rule-case-toggle').checked = false;
    return;
  }
  row.remove();
  updateJoinSelectors();
  if (allLines.length > 0) {
    applyFilters();
  }
}

function attachRuleHandlers(row) {
  row.querySelectorAll('select').forEach((el) => {
    el.addEventListener('change', () => {
      if (allLines.length > 0) applyFilters();
    });
  });
  row.querySelectorAll('.rule-case-toggle').forEach((el) => {
    el.addEventListener('change', () => {
      if (allLines.length > 0) applyFilters();
    });
  });
  row.querySelectorAll('.rule-value').forEach((el) => {
    el.addEventListener('input', () => {
      applyFiltersDebounced();
    });
  });
  row.querySelector('.rule-remove')?.addEventListener('click', () => removeRuleRow(row));
}

rulesList.querySelectorAll('[data-rule]').forEach((row) => attachRuleHandlers(row));
addRuleBtn.addEventListener('click', addRuleRow);

[pageSizeInput].forEach((el) => {
  el.addEventListener('change', () => {
    if (allLines.length > 0) {
      applyFilters();
    }
  });
});

pageSizeInput.addEventListener('input', () => {
  applyFiltersDebounced();
});

function updateJoinSelectors() {
  const rows = Array.from(rulesList.querySelectorAll('[data-rule]'));
  rows.forEach((row, index) => {
    const joinSelect = row.querySelector('.rule-join');
    if (!joinSelect) return;
    if (index === 0) {
      joinSelect.disabled = true;
    } else {
      joinSelect.disabled = false;
    }
  });
}

updateJoinSelectors();

toggleSidebarBtn.addEventListener('click', () => {
  isSidebarCollapsed = !isSidebarCollapsed;
  sidebarEl.classList.toggle('collapsed', isSidebarCollapsed);
  document.body.querySelector('.app')?.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
  toggleSidebarBtn.querySelector('.sidebar-toggle-icon').textContent = isSidebarCollapsed ? '>' : '<';
});

copyBtn.addEventListener('click', async () => {
  const { pageSize, totalPages } = getPagination();
  const start = (currentPage - 1) * pageSize;
  const end = allLines.length > 2000 ? start + pageSize : filtered.length;
  const pageLines = filtered.slice(start, end).map((item) => item.text).join('\n');
  try {
    await navigator.clipboard.writeText(pageLines);
    statusEl.textContent = 'Скопійовано у буфер обміну';
  } catch (err) {
    statusEl.textContent = 'Не вдалося скопіювати';
    statusEl.classList.add('error');
  }
});
