const editor = document.querySelector("#editor");
const htmlOutput = document.querySelector("#htmlOutput");
const preview = document.querySelector("#preview");
const charCount = document.querySelector("#charCount");
const statusEl = document.querySelector("#status");
const emojiToggle = document.querySelector("#emojiToggle");
const emojiPanel = document.querySelector("#emojiPanel");

let savedSelection = null;

const allowedTags = new Set(["B", "STRONG", "I", "EM", "P", "BR", "UL", "OL", "LI"]);
const blockTags = new Set(["DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE"]);
const headingTags = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const paragraphBreakers = new Set(["P", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BR"]);

const sampleHtml = `
  <h2>Product Features</h2>
  <p><strong>High efficiency filtration:</strong> Captures fine dust and keeps your vacuum cleaner performing reliably.</p>
  <ul>
    <li>Compatible with selected replacement parts.</li>
    <li>Easy to install and remove.</li>
    <li><em>Recommended replacement cycle:</em> every 2-3 months.</li>
  </ul>
  <p>Please check your model number before purchase.</p>
`;

function setStatus(text, type = "") {
  if (!statusEl) return;
  const textEl = statusEl.querySelector(".status-text");
  if (textEl) {
    textEl.textContent = text;
  } else {
    statusEl.textContent = text;
  }
  statusEl.className = "status" + (type ? " status--" + type : "");
}

function resizeOutputArea() {
  htmlOutput.style.height = "auto";
  htmlOutput.style.height = `${htmlOutput.scrollHeight}px`;
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    savedSelection = range.cloneRange();
  }
}

function restoreEditorSelection() {
  editor.focus();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  if (savedSelection) {
    selection.addRange(savedSelection);
  }
}

function insertTextAtCursor(text) {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.appendChild(document.createTextNode(text));
    updateOutput();
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  savedSelection = range.cloneRange();
  updateOutput();
}

function normalizeText(text) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t\n\r]+/g, " ");
}

function unwrapChildren(sourceNode, targetParent) {
  Array.from(sourceNode.childNodes).forEach((child) => {
    const cleanChild = cleanNode(child);
    if (cleanChild) {
      targetParent.appendChild(cleanChild);
    }
  });
}

function hasParagraphBreaker(node) {
  return Array.from(node.childNodes).some((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    return paragraphBreakers.has(child.tagName) || hasParagraphBreaker(child);
  });
}

function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const normalized = normalizeText(node.textContent);
    return normalized ? document.createTextNode(normalized) : null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tag = node.tagName;

  if (["SCRIPT", "STYLE", "IFRAME", "IMG", "A", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"].includes(tag)) {
    const fragment = document.createDocumentFragment();
    unwrapChildren(node, fragment);
    return fragment.childNodes.length ? fragment : null;
  }

  if (tag === "SPAN" || tag === "FONT") {
    const fragment = document.createDocumentFragment();
    unwrapChildren(node, fragment);
    return fragment.childNodes.length ? fragment : null;
  }

  if (blockTags.has(tag)) {
    if (hasParagraphBreaker(node)) {
      const fragment = document.createDocumentFragment();
      unwrapChildren(node, fragment);
      return fragment.childNodes.length ? fragment : null;
    }

    const wrapper = document.createElement("p");
    unwrapChildren(node, wrapper);
    return wrapper.childNodes.length ? wrapper : null;
  }

  if (headingTags.has(tag)) {
    const paragraph = document.createElement("p");
    const bold = document.createElement("b");
    unwrapChildren(node, bold);
    if (bold.childNodes.length) {
      paragraph.appendChild(bold);
    }
    return paragraph.childNodes.length ? paragraph : null;
  }

  if (!allowedTags.has(tag)) {
    const fragment = document.createDocumentFragment();
    unwrapChildren(node, fragment);
    return fragment.childNodes.length ? fragment : null;
  }

  const cleanTag = tag === "STRONG" ? "b" : tag === "EM" ? "i" : tag.toLowerCase();
  const cleanElement = document.createElement(cleanTag);
  unwrapChildren(node, cleanElement);

  if (cleanTag === "br") {
    return cleanElement;
  }

  return cleanElement.childNodes.length ? cleanElement : null;
}

function removeEmptyBlocks(container) {
  container.querySelectorAll("p, h1, h2, h3, li").forEach((node) => {
    const hasBreak = node.querySelector("br");
    const hasText = node.textContent.trim().length > 0;
    if (!hasText && !hasBreak) {
      node.remove();
    }
  });
}

function serializeCleanHtml(container) {
  let html = container.innerHTML;
  html = html.replace(/<p><br><\/p>/gi, "<br>");
  html = html.replace(/<\/(p|h1|h2|h3|ul|ol)>\s*</gi, "</$1>\n<");
  html = html.replace(/<\/li>\s*<li>/gi, "</li>\n<li>");
  html = html.replace(/\n{3,}/g, "\n\n").trim();
  return html;
}

function convertHtml(inputHtml) {
  const source = document.createElement("div");
  source.innerHTML = inputHtml;

  const output = document.createElement("div");
  Array.from(source.childNodes).forEach((node) => {
    const clean = cleanNode(node);
    if (clean) {
      output.appendChild(clean);
    }
  });

  removeEmptyBlocks(output);
  return serializeCleanHtml(output);
}

function updateOutput() {
  const html = convertHtml(editor.innerHTML);
  htmlOutput.value = html;
  resizeOutputArea();
  preview.innerHTML = html;
  charCount.textContent = `${html.length} 字符`;
  setStatus(html ? "已转换" : "等待输入", html ? "success" : "");
}

function copyOutput() {
  updateOutput();
  if (!htmlOutput.value) {
    setStatus("无内容", "warning");
    return;
  }

  navigator.clipboard.writeText(htmlOutput.value)
    .then(() => setStatus("已复制", "copied"))
    .catch(() => {
      htmlOutput.select();
      document.execCommand("copy");
      setStatus("已复制", "copied");
    });
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    editor.focus();
    document.execCommand(button.dataset.command, false, null);
    updateOutput();
  });
});

document.querySelector("#headingBtn").addEventListener("click", () => {
  editor.focus();
  document.execCommand("formatBlock", false, "p");
  document.execCommand("bold", false, null);
  updateOutput();
});

document.querySelector("#paragraphBtn").addEventListener("click", () => {
  editor.focus();
  document.execCommand("formatBlock", false, "p");
  updateOutput();
});

const convertBtn = document.querySelector("#convertBtn");
if (convertBtn) convertBtn.addEventListener("click", updateOutput);
document.querySelector("#copyBtn").addEventListener("click", copyOutput);
document.querySelector("#clearBtn").addEventListener("click", () => {
  editor.innerHTML = "";
  updateOutput();
});
document.querySelector("#sampleBtn").addEventListener("click", () => {
  editor.innerHTML = sampleHtml;
  updateOutput();
});

emojiToggle.addEventListener("click", () => {
  const isOpen = !emojiPanel.hidden;
  emojiPanel.hidden = isOpen;
  emojiToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (emojiPanel.hidden) {
    return;
  }

  if (!event.target.closest(".emoji-picker")) {
    emojiPanel.hidden = true;
    emojiToggle.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !emojiPanel.hidden) {
    emojiPanel.hidden = true;
    emojiToggle.setAttribute("aria-expanded", "false");
    emojiToggle.focus();
  }
});

emojiToggle.addEventListener("blur", saveEditorSelection);
emojiPanel.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

emojiPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-emoji]");
  if (!button) {
    return;
  }

  insertTextAtCursor(button.dataset.emoji);
  setStatus("已插入 emoji", "success");
  emojiPanel.hidden = true;
  emojiToggle.setAttribute("aria-expanded", "false");
});

editor.addEventListener("input", updateOutput);
editor.addEventListener("keyup", saveEditorSelection);
editor.addEventListener("mouseup", saveEditorSelection);
editor.addEventListener("blur", saveEditorSelection);
editor.addEventListener("paste", () => {
  window.setTimeout(updateOutput, 0);
});

htmlOutput.addEventListener("input", () => {
  preview.innerHTML = convertHtml(htmlOutput.value);
  charCount.textContent = `${htmlOutput.value.length} 字符`;
  resizeOutputArea();
  setStatus("已编辑", "success");
});

updateOutput();
