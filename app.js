// GASのウェブアプリURLをここに貼る
const GAS_URL = "https://script.google.com/macros/s/AKfycbwFGWXonRPSDqhToxurlrxmvb0oMydOdM18_2Jy5aQWDXP60o6bKjkjYYfu741dgkqB/exec";

function getCheckedValues() {
  return Array.from(document.querySelectorAll('.checkbox-group input[type=checkbox]:checked'))
              .map(cb => cb.value);
}

async function generate() {
  const theme = document.getElementById('theme').value.trim();
  if (!theme) { alert('研究テーマを入力してください。'); return; }

  const background  = document.getElementById('background').value.trim();
  const design      = document.getElementById('design').value;
  const setting     = document.getElementById('setting').value.trim();
  const focusAreas  = getCheckedValues();

  const btn           = document.getElementById('generateBtn');
  const loading       = document.getElementById('loading');
  const result        = document.getElementById('result');
  const errorBox      = document.getElementById('errorBox');
  const resultContent = document.getElementById('resultContent');
  const statusBar     = document.getElementById('statusBar');
  const copyBtn       = document.getElementById('copyBtn');
　const resetBtn      = document.getElementById('resetBtn'); 
  const pdfBtn        = document.getElementById('pdfBtn'); 
  
  btn.disabled = true;
  loading.style.display   = 'flex';
  result.style.display    = 'none';
  errorBox.style.display  = 'none';
  resultContent.style.display = 'none';
  copyBtn.style.display   = 'none';
  if (resetBtn) resetBtn.style.display = 'none';
  if (pdfBtn) pdfBtn.style.display = 'none';  
  statusBar.textContent   = '';
  resultContent.innerHTML = '';

  const prompt = buildPrompt(theme, background, design, setting, focusAreas);

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'APIエラー: ' + response.status);
    }

    const data = await response.json();
    const fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!fullText) throw new Error('レスポンスが空です。GASのデプロイ設定を確認してください。');

    loading.style.display       = 'none';
    result.style.display        = 'block';
    resultContent.innerHTML     = markdownToHtml(fullText);
    resultContent.style.display = 'block';
    statusBar.innerHTML = '<span class="status-done">✅ 出力完了（' + fullText.length + '文字）</span>';
    copyBtn.style.display = 'inline-block';
    if (resetBtn) resetBtn.style.display = 'inline-block'; 
    if (pdfBtn) pdfBtn.style.display = 'inline-block';  
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (e) {
    loading.style.display  = 'none';
    result.style.display   = 'none';
    errorBox.textContent   = 'エラーが発生しました: ' + e.message;
    errorBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

function buildPrompt(theme, background, design, setting, focusAreas) {
  let p = 'あなたは看護研究の専門家です。以下の看護研究アイデアを分析し、改善提案を行ってください。\n\n';
  p += '## 入力情報\n';
  p += '- 研究テーマ: ' + theme + '\n';
  if (background)        p += '- 研究背景: ' + background + '\n';
  if (design)            p += '- 研究デザイン: ' + design + '\n';
  if (setting)           p += '- 対象部署: ' + setting + '\n';
  if (focusAreas.length) p += '- 重点項目: ' + focusAreas.join('、') + '\n';
  p += '\n## 出力指示\n';
  p += '以下の9つのセクションを**すべて最後まで**出力してください。途中で終わらないよう、各セクションを簡潔にまとめてください。\n\n';
  p += '### 1. 研究テーマの評価\n意義・独自性・実施可能性を3文で評価。\n\n';
  p += '### 2. PICO/PECOフレーム整理\n| 要素 | 内容 |\n|------|------|\n| P（対象） | |\n| I/E（介入/曝露） | |\n| C（比較） | |\n| O（アウトカム） | |\n\n';
  p += '### 3. 推奨研究デザイン\n最適デザインと理由。代替案1つ。\n\n';
  p += '### 4. アウトカム指標の提案\n主要・副次アウトカムと既存尺度を箇条書き。\n\n';
  p += '### 5. データ収集方法\n具体的な手順とツールを箇条書き。\n\n';
  p += '### 6. 統計解析方法\n解析手法を箇条書き。\n\n';
  p += '### 7. 倫理的配慮\n主要な課題を3〜4点箇条書き。\n\n';
  p += '### 8. 改善・強化ポイント\n提案を3〜5点箇条書き。\n\n';
  p += '### 9. 文献検索キーワード\nPubMed用英語5個・医中誌用日本語5個。';
  return p;
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '', tableRows = [], listItems = [];

  function flushList() {
    if (!listItems.length) return;
    html += '<ul>' + listItems.map(i => '<li>' + i + '</li>').join('') + '</ul>';
    listItems = [];
  }
  function flushTable() {
    if (!tableRows.length) return;
    let t = '<table>';
    tableRows.forEach((row, i) => {
      if (/^\|[-| ]+\|$/.test(row.trim())) return;
      const cells = row.trim().split('|').map(c => c.trim()).filter(c => c !== '');
      if (i === 0) t += '<thead><tr>' + cells.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
      else         t += '<tr>'        + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
    });
    t += '</tbody></table>';
    html += t;
    tableRows = [];
  }

  lines.forEach(line => {
    if (line.trim().startsWith('|')) {
      flushList(); tableRows.push(line); return;
    }
    if (tableRows.length) flushTable();
    if      (line.startsWith('### ')) { flushList(); html += '<h3>' + inl(line.slice(4)) + '</h3>'; }
    else if (line.startsWith('## '))  { flushList(); html += '<h3>' + inl(line.slice(3)) + '</h3>'; }
    else if (/^[-*] /.test(line))     { listItems.push(inl(line.replace(/^[-*] /,''))); }
    else if (/^\d+\. /.test(line))    { listItems.push(inl(line.replace(/^\d+\. /,''))); }
    else if (line.trim() === '')      { flushList(); }
    else                              { flushList(); html += '<p>' + inl(line) + '</p>'; }
  });
  flushList(); flushTable();
  return html;
}

function inl(t) {
  return t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
          .replace(/\*(.+?)\*/g,'<em>$1</em>');
}

function copyResult() {
  const text = document.getElementById('resultContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const b = document.getElementById('copyBtn');
    b.textContent = '✅ コピーしました！';
    setTimeout(() => { b.textContent = '📋 結果をコピー'; }, 2000);
  });
}
function printResult() {
  const content = document.getElementById('resultContent');
  if (!content || !content.innerHTML.trim()) {
    alert('出力する内容がありません。');
    return;
  }

  // 新しいウィンドウに結果だけを描画して印刷
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>看護研究アイデア ブラッシュアップ結果</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          h1, h2, h3 {
            margin-top: 1.2em;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            font-size: 12px;
          }
          th {
            background: #f5f5f5;
          }
          ul {
            padding-left: 20px;
          }
        </style>
      </head>
      <body>
        <h1>看護研究アイデア ブラッシュアップ結果</h1>
        ${content.innerHTML}
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();  // ブラウザの印刷ダイアログ → PDF保存可
}

function resetForm() {
  // 入力欄クリア
  document.getElementById('theme').value = '';
  document.getElementById('background').value = '';
  document.getElementById('design').value = '';
  document.getElementById('setting').value = '';

  // チェックボックス解除
  document.querySelectorAll('.checkbox-group input[type=checkbox]')
    .forEach(cb => cb.checked = false);

  // 結果表示を消して初期状態に
  document.getElementById('resultContent').innerHTML = '';
  document.getElementById('resultContent').style.display = 'none';
  document.getElementById('statusBar').textContent = '';
  document.getElementById('errorBox').style.display = 'none';

  document.getElementById('copyBtn').style.display = 'none';
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.style.display = 'none';

  // コピー済み表示を元に戻す（念のため）
  const b = document.getElementById('copyBtn');
  if (b) b.textContent = '📋 結果をコピー';

  // ページ上部の入力カードへスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('theme').addEventListener('keydown', e => {
  if (e.key === 'Enter') generate();
});
