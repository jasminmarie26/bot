const fs = require("fs");
const vm = require("vm");
const path = require("path");

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, "src/index.js"), "utf8");
const start = source.indexOf("function escapeHtml(value)");
const end = source.indexOf("function normalizeGuestbookColor(rawColor)");
if (start < 0 || end < 0 || end <= start) throw new Error("Could not extract guestbook renderer functions");
const snippet = source.slice(start, end);
const context = {
  console,
  URL,
  normalizeImageUrl: (value) => String(value || "").trim(),
  isSafeGuestbookImageUrl: (value) => /^https?:\/\//i.test(String(value || "")),
  isSafeGuestbookVideoUrl: () => false,
  getGuestbookYoutubeEmbedUrl: () => "",
  parseGuestbookButtonArgs: () => null,
  sanitizeGuestbookButtonStyle: () => "",
  sanitizeGuestbookButtonTarget: () => "",
  sanitizeGuestbookColor: (value) => String(value || "").trim(),
  sanitizeGuestbookFontSize: (value) => String(value || "").trim(),
  decodeHtmlEntities: (value) => String(value || ""),
  normalizeBbcodeMarkup: (value) => String(value || ""),
  decodeGuestbookUnicodeEscapes: (value) => String(value || ""),
  sanitizeGuestbookAlignment: (value) => String(value || "").trim(),
  sanitizeGuestbookListStyle: () => "disc",
  sanitizeGuestbookHeadingLevel: () => "2"
};
vm.createContext(context);
vm.runInContext(snippet, context);
const bbcode = fs.readFileSync(path.join(repoRoot, ".codex-temp/guestbook-sample.bbcode"), "utf8");
const html = context.renderGuestbookBbcode(bbcode, {
  maxLength: 0,
  compactImageLineBreaks: false,
  compactBlockLineBreaks: false
});
const page = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>GB Repro</title>
  <link rel="stylesheet" href="file:///${path.join(repoRoot, "public/styles.css").replace(/\\/g, "/")}">
  <style>
    body { margin: 0; background: #f4f4f4; }
    .wrap { width: 1400px; margin: 0 auto; padding: 32px 0; }
    .guestbook-page-preview { width: 500px; margin: 0 auto; }
    #debug { position: fixed; inset: 0 auto auto 0; max-height: 45vh; overflow: auto; background: rgba(0,0,0,.85); color: #0f0; font: 12px/1.4 monospace; padding: 10px; white-space: pre-wrap; z-index: 99999; width: 520px; }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="guestbook-page-preview gb-theme-transparent-pur gb-font-default">
      <div class="guestbook-entry-body">${html}</div>
    </article>
  </div>
  <pre id="debug"></pre>
  <script>
    const items = [];
    const body = document.querySelector('.guestbook-entry-body');
    const selectors = ['.guestbook-entry-body','.bb-center','.bb-table-wrap','.bb-table','span','div'];
    const pushInfo = (label, el, index) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      items.push({label,index,tag:el.tagName.toLowerCase(),className:el.className || '',display:style.display,position:style.position,lineHeight:style.lineHeight,fontSize:style.fontSize,marginTop:style.marginTop,marginBottom:style.marginBottom,top:Math.round(rect.top),height:Math.round(rect.height),text:(el.textContent || '').replace(/\s+/g,' ').trim().slice(0,80)});
    };
    pushInfo('root', body, 0);
    document.querySelectorAll('.guestbook-entry-body > *').forEach((el, index) => pushInfo('child', el, index));
    document.querySelectorAll('.bb-center').forEach((el, index) => pushInfo('center', el, index));
    document.querySelectorAll('.bb-table-wrap').forEach((el, index) => pushInfo('wrap', el, index));
    document.querySelectorAll('.bb-table').forEach((el, index) => pushInfo('table', el, index));
    document.getElementById('debug').textContent = JSON.stringify(items, null, 2);
  </script>
</body>
</html>`;
fs.writeFileSync(path.join(repoRoot, ".codex-temp/guestbook-repro-debug.html"), page, "utf8");
console.log(path.join(repoRoot, ".codex-temp/guestbook-repro-debug.html"));
