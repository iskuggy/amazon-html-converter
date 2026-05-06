"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Trash2, FileText, Code2, Eye, Bold, Italic, List, ListOrdered, Smile, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ALLOWED_TAGS = ["p", "br", "ul", "ol", "li", "b", "strong", "i", "em"];
const BLOCK_TAGS = ["p", "div", "section", "article", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"];
const TOP_LEVEL_BLOCK_TAGS = ["p", "ul", "ol"];

function sanitizeAmazonHtml(html: string) {
  if (!html) return "";

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  const walk = (node: Node): Node => {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return doc.createTextNode("");

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    let mappedTag = tag;
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) mappedTag = "p";
    if (tag === "div" || tag === "section" || tag === "article") {
      mappedTag = [...el.childNodes].some((child) => child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.includes((child as Element).tagName.toLowerCase()))
        ? "fragment"
        : "p";
    }
    if (tag === "p" && [...el.childNodes].some((child) => child.nodeType === Node.ELEMENT_NODE && ["ul", "ol", "p"].includes((child as Element).tagName.toLowerCase()))) {
      mappedTag = "fragment";
    }
    if (tag === "span") mappedTag = "fragment";
    if (tag === "strong") mappedTag = "b";
    if (tag === "em") mappedTag = "i";

    if (mappedTag === "fragment") {
      const fragment = doc.createDocumentFragment();
      [...el.childNodes].forEach((child) => fragment.appendChild(walk(child)));
      return fragment;
    }

    if (!ALLOWED_TAGS.includes(mappedTag)) {
      const fragment = doc.createDocumentFragment();
      [...el.childNodes].forEach((child) => fragment.appendChild(walk(child)));
      return fragment;
    }

    const newEl = doc.createElement(mappedTag);
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      const bold = doc.createElement("b");
      [...el.childNodes].forEach((child) => bold.appendChild(walk(child)));
      newEl.appendChild(bold);
    } else {
      [...el.childNodes].forEach((child) => newEl.appendChild(walk(child)));
    }
    return newEl;
  };

  const cleanRoot = doc.createElement("div");
  [...root.childNodes].forEach((child) => cleanRoot.appendChild(walk(child)));

  const normalizedRoot = doc.createElement("div");
  let paragraph: HTMLElement | null = null;
  const flushParagraph = () => {
    if (!paragraph) return;
    const hasBreak = paragraph.querySelector("br");
    const hasText = (paragraph.textContent?.trim().length ?? 0) > 0;
    if (hasBreak || hasText) {
      normalizedRoot.appendChild(paragraph);
    }
    paragraph = null;
  };

  [...cleanRoot.childNodes].forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE && TOP_LEVEL_BLOCK_TAGS.includes((child as Element).tagName.toLowerCase())) {
      flushParagraph();
      normalizedRoot.appendChild(child);
      return;
    }

    if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) {
      return;
    }

    paragraph ??= doc.createElement("p");
    paragraph.appendChild(child);
  });
  flushParagraph();

  normalizedRoot.querySelectorAll("p, li").forEach((node) => {
    const hasBreak = node.querySelector("br");
    const hasText = (node.textContent?.trim().length ?? 0) > 0;
    if (!hasText && !hasBreak) {
      node.remove();
    }
  });

  return normalizedRoot.innerHTML
    .replace(/\s+<\/li>/g, "</li>")
    .replace(/>\s+</g, "><")
    .trim();
}

function formatHtml(html: string) {
  if (!html) return "";
  return html
    .replace(/></g, ">\n<")
    .replace(/<(ul|ol)>/g, "<$1>\n")
    .replace(/<\/(ul|ol)>/g, "\n</$1>")
    .replace(/<li>/g, "  <li>")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getAiSuggestions(html: string) {
  if (!html) {
    return ["粘贴文案后，这里会实时给出移动端可读性、结构和合规风险建议。"];
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
  const suggestions: string[] = [];
  const listItems = Array.from(doc.querySelectorAll("li"));
  const paragraphs = Array.from(doc.querySelectorAll("p"));
  const emojiCount = [...text].filter((char) => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(char)).length;
  const longListItems = listItems.filter((item) => (item.textContent?.trim().length || 0) > 120).length;
  const longParagraphs = paragraphs.filter((item) => (item.textContent?.trim().length || 0) > 220).length;

  if (text.length < 80) {
    suggestions.push("内容偏短，可以补充 2-3 个核心卖点，尤其是兼容性、使用场景和维护周期。");
  } else if (text.length > 1200) {
    suggestions.push("内容偏长，移动端阅读压力较大。建议把长段拆成短段或列表，优先保留最影响转化的卖点。");
  } else {
    suggestions.push("整体长度比较适中，适合桌面和手机端阅读。");
  }

  if (listItems.length === 0) {
    suggestions.push("建议至少使用一组项目符号，把核心卖点拆开，手机端会更容易扫读。");
  } else if (longListItems > 0) {
    suggestions.push(`${longListItems} 个列表项偏长，建议每条控制在 80-120 字以内。`);
  } else {
    suggestions.push("列表结构清晰，适合移动端快速扫读。");
  }

  if (longParagraphs > 0) {
    suggestions.push(`${longParagraphs} 个段落偏长，建议拆成更短段落或转成项目符号。`);
  }

  if (emojiCount > 8) {
    suggestions.push("emoji 数量偏多，可能显得促销感过强。建议只保留用于强调关键卖点的少数几个。");
  } else if (emojiCount > 0) {
    suggestions.push("emoji 使用量可控，注意不同站点/类目最终展示可能仍会被过滤。");
  }

  if (!/<b>/.test(html) && text.length > 120) {
    suggestions.push("可以给关键短语加粗，例如兼容型号、核心功能或替换周期。");
  }

  return suggestions.slice(0, 5);
}

const exampleHtml = `
<p><b>Premium Replacement Vacuum Filter Kit</b></p>
<p>Designed for daily home cleaning and long-term machine protection.</p>
<ul>
  <li>Compatible with selected vacuum cleaner models</li>
  <li>Helps capture dust, pollen, and fine particles</li>
  <li>Easy to install and replace without tools</li>
</ul>
<p>For best performance, replace the filter every 2-3 months depending on usage.</p>
`;

const emojiGroups = [
  {
    title: "卖点",
    emojis: ["✅", "⭐", "🔥", "💡", "👍", "💪", "🏆", "💎"],
  },
  {
    title: "物流",
    emojis: ["🚚", "📦", "🎁", "🛒", "⏱️", "🌍"],
  },
  {
    title: "提示",
    emojis: ["⚠️", "❌", "🔔", "📌", "🔍", "📏"],
  },
  {
    title: "方向",
    emojis: ["➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "🔼", "🔽", "▶️", "◀️", "🔁", "🔄", "➤", "→", "✔", "★"],
  },
];

const quickEmojis = ["✅", "⭐", "🔥", "💡", "👍", "🚚", "📦", "⚠️", "➡️"];

export default function AmazonHtmlConverter() {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [rawHtml, setRawHtml] = useState("");
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const [amazonHtml, setAmazonHtml] = useState("");
  const [formattedHtml, setFormattedHtml] = useState("");
  const [plainTextLength, setPlainTextLength] = useState(0);
  const aiSuggestions = getAiSuggestions(amazonHtml);

  useEffect(() => {
    const cleaned = sanitizeAmazonHtml(rawHtml);
    setAmazonHtml(cleaned);
    setFormattedHtml(formatHtml(cleaned));
    const doc = new DOMParser().parseFromString(cleaned, "text/html");
    setPlainTextLength(doc.body.textContent?.length || 0);
  }, [rawHtml]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();

    if (savedRangeRef.current) {
      try {
        selection.addRange(savedRangeRef.current);
        return;
      } catch {
        savedRangeRef.current = null;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  const runCommand = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value ?? "");
    setRawHtml(editorRef.current?.innerHTML || "");
    saveSelection();
  };

  const insertLineBreak = () => {
    restoreSelection();
    document.execCommand("insertHTML", false, "<br>");
    setRawHtml(editorRef.current?.innerHTML || "");
    saveSelection();
  };

  const insertEmoji = (emoji: string) => {
    restoreSelection();
    document.execCommand("insertText", false, emoji);
    setRawHtml(editorRef.current?.innerHTML || "");
    saveSelection();
    setEmojiOpen(false);
  };

  const keepEditorSelection = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    saveSelection();
  };

  const pasteAsPlainText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!editorRef.current) return;
      editorRef.current.innerHTML = text
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      setRawHtml(editorRef.current.innerHTML);
    } catch {
      alert("浏览器未授权读取剪贴板，请直接粘贴到左侧编辑区。");
    }
  };

  const loadExample = () => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = exampleHtml;
    setRawHtml(exampleHtml);
  };

  const clearAll = () => {
    if (!rawHtml) return;
    const ok = window.confirm("确定清空当前内容？");
    if (!ok) return;
    if (!editorRef.current) return;
    editorRef.current.innerHTML = "";
    setRawHtml("");
  };

  const copyHtml = async () => {
    if (!formattedHtml) return;
    await navigator.clipboard.writeText(formattedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const onInput = () => {
    setRawHtml(editorRef.current?.innerHTML || "");
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    const content = html || text
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");

    document.execCommand("insertHTML", false, content);
    setTimeout(onInput, 0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !event.shiftKey) return;
    event.preventDefault();
    document.execCommand("insertHTML", false, "<br>");
    window.setTimeout(onInput, 0);
  };

  return (
    <div className="min-h-screen bg-[#F5F7F8] text-slate-900">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-5 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
              <Code2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">亚马逊 HTML 转换器</h1>
              <p className="mt-1 text-sm text-slate-500">将 Word、飞书、网页文案一键转换为 Amazon Listing 可用 HTML</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full">保留 p / br / ul / ol / li / b / i</Badge>
                <Badge variant="secondary" className="rounded-full">自动过滤 h1 / h2 / h3</Badge>
                <Badge variant="secondary" className="rounded-full">适合产品描述和五点文案</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Button onClick={copyHtml} disabled={!formattedHtml} className="rounded-xl bg-brand px-5 hover:bg-brand-dark">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "已复制" : "复制 HTML"}
            </Button>
            <Button variant="outline" onClick={loadExample} className="rounded-xl">
              <FileText className="mr-2 h-4 w-4" />
              示例
            </Button>
            <Button variant="outline" onClick={pasteAsPlainText} className="rounded-xl">
              <RotateCcw className="mr-2 h-4 w-4" />
              剪贴板转纯文本
            </Button>
            <Button variant="outline" onClick={clearAll} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              清空内容
            </Button>
          </div>
        </section>

        <section className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Card className="relative z-30 min-w-0 overflow-visible rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between bg-white px-5 py-4">
              <div>
                <CardTitle className="text-base">粘贴文案</CardTitle>
                <p className="mt-1 text-xs text-slate-500">支持从 Word、飞书、网页或 ChatGPT 直接复制粘贴</p>
              </div>
              <Badge variant="outline" className="rounded-full">输入区</Badge>
            </CardHeader>
            <CardContent className="overflow-visible p-0">
              <div className="flex flex-wrap items-center gap-1.5 border-y border-slate-200 bg-slate-50 px-3 py-2">
                <Button variant="ghost" size="sm" onMouseDown={keepEditorSelection} onClick={() => runCommand("bold")} className="rounded-lg">
                  <Bold className="mr-2 h-4 w-4" />加粗
                </Button>
                <Button variant="ghost" size="sm" onMouseDown={keepEditorSelection} onClick={() => runCommand("italic")} className="rounded-lg">
                  <Italic className="mr-2 h-4 w-4" />斜体
                </Button>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <Button variant="ghost" size="sm" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertUnorderedList")} className="rounded-lg">
                  <List className="mr-2 h-4 w-4" />项目符号
                </Button>
                <Button variant="ghost" size="sm" onMouseDown={keepEditorSelection} onClick={() => runCommand("insertOrderedList")} className="rounded-lg">
                  <ListOrdered className="mr-2 h-4 w-4" />编号列表
                </Button>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <Button variant="ghost" size="sm" onMouseDown={keepEditorSelection} onClick={insertLineBreak} className="rounded-lg">换行</Button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={onInput}
                onPaste={onPaste}
                onKeyDown={onKeyDown}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={saveSelection}
                className="min-h-[420px] w-full min-w-0 overflow-x-hidden whitespace-pre-wrap break-words bg-white px-5 py-4 text-sm leading-7 outline-none [overflow-wrap:anywhere] [word-break:break-word] empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_b]:font-semibold [&_i]:italic [&_li]:my-1 [&_li]:pl-1 [&_ol]:my-3 [&_ol]:ml-7 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:my-3 [&_ul]:ml-7 [&_ul]:list-disc"
                data-placeholder="在这里粘贴产品描述、Bullet Points 或 A+ 文案..."
              />
              <div className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
                粘贴后会自动清理多余样式，仅保留亚马逊允许的基础 HTML 标签。
              </div>
            </CardContent>
          </Card>

          <Card className="relative z-40 min-w-0 overflow-visible rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between bg-white px-5 py-4">
              <div>
                <CardTitle className="text-base">亚马逊 HTML</CardTitle>
                <p className="mt-1 text-xs text-slate-500">已过滤标题、样式、脚本和不推荐标签</p>
              </div>
              <Badge variant="outline" className="rounded-full">{plainTextLength} 字符</Badge>
            </CardHeader>
            <CardContent className="overflow-visible p-0">
              <div className="flex flex-wrap items-center gap-1.5 border-y border-slate-200 bg-slate-50 px-3 py-2">
                <span className="px-2 text-xs font-medium text-slate-500">常用 Emoji</span>
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={keepEditorSelection}
                    onClick={() => insertEmoji(emoji)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base transition hover:border-brand hover:bg-white"
                    aria-label={`插入 ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={keepEditorSelection}
                    onClick={() => setEmojiOpen((open) => !open)}
                    className="rounded-lg"
                    aria-expanded={emojiOpen}
                  >
                    <Smile className="mr-2 h-4 w-4" />更多
                  </Button>
                  {emojiOpen ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      {emojiGroups.map((group) => (
                        <div key={group.title} className="mb-3 last:mb-0">
                          <div className="mb-2 px-1 text-xs font-medium text-slate-500">{group.title}</div>
                          <div className="grid grid-cols-8 gap-1.5">
                            {group.emojis.map((emoji) => (
                              <button
                                key={`${group.title}-${emoji}`}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg transition hover:border-brand hover:bg-slate-50"
                                aria-label={`插入 ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <pre className="min-h-[420px] max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words bg-slate-950 px-5 py-4 text-sm leading-6 text-slate-100 [overflow-wrap:anywhere] [word-break:break-word]">
                <code>{formattedHtml || "<!-- 转换后的 Amazon HTML 将显示在这里 -->"}</code>
              </pre>
              <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
                <span>输出不生成 h1 / h2 / h3 等标题标签。</span>
                <button onClick={copyHtml} disabled={!formattedHtml} className="font-medium text-brand disabled:text-slate-400">复制代码</button>
              </div>
              <div className="border-t bg-white px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center text-sm font-semibold text-slate-800">
                    <Sparkles className="mr-2 h-4 w-4 text-brand" />AI 实时建议
                  </div>
                  <Badge variant="outline" className="rounded-full bg-slate-50 text-[11px]">本地规则</Badge>
                </div>
                <ul className="space-y-2 text-xs leading-5 text-slate-600">
                  {aiSuggestions.map((suggestion) => (
                    <li key={suggestion} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="mt-5 overflow-hidden rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between border-b bg-white px-5 py-4">
            <div>
              <CardTitle className="flex items-center text-base">
                <Eye className="mr-2 h-4 w-4" />亚马逊前台预览
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">模拟基础 Product Description 展示效果，实际效果以 Amazon Seller Central 为准</p>
            </div>
            <Badge variant="secondary" className="rounded-full">实时预览</Badge>
          </CardHeader>
          <CardContent className="bg-white p-6">
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 border-b pb-3 text-lg font-semibold text-slate-900">Product Description</h2>
                {amazonHtml ? (
                  <div
                    className="amazon-preview break-words text-sm leading-7 text-slate-800 [overflow-wrap:anywhere] [word-break:break-word] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_b]:font-semibold [&_i]:italic [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: amazonHtml }}
                  />
                ) : (
                  <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                    预览内容将在这里显示
                  </div>
                )}
              </div>

              <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center text-sm font-semibold text-slate-800">
                  <Smartphone className="mr-2 h-4 w-4" />手机 App 端预览
                </div>
                <div className="mx-auto w-full max-w-[312px] rounded-[2rem] border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="relative aspect-[1206/2622] overflow-hidden rounded-[1.65rem] border border-slate-100 bg-white">
                    <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
                    <div className="flex h-full flex-col">
                      <div className="border-b border-slate-100 bg-white px-5 pb-3 pt-9">
                        <div className="mb-4 flex items-center justify-between text-[11px] font-semibold text-slate-900">
                          <span>9:41</span>
                          <span className="tracking-tight">5G 100%</span>
                        </div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Amazon</div>
                        <div className="mt-1 text-base font-semibold leading-tight text-slate-950">Product Description</div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        {amazonHtml ? (
                          <div
                            className="break-words text-[13px] leading-6 text-slate-800 [overflow-wrap:anywhere] [word-break:break-word] [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_*]:[word-break:break-word] [&_b]:font-semibold [&_i]:italic [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
                            dangerouslySetInnerHTML={{ __html: amazonHtml }}
                          />
                        ) : (
                          <div className="flex h-full min-h-[180px] items-center justify-center rounded-2xl bg-slate-50 px-4 text-center text-xs leading-5 text-slate-400">
                            手机端预览内容将在这里显示
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">Amazon HTML Converter · Built for listing content cleanup</p>
      </main>
    </div>
  );
}
