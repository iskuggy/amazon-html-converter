"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Trash2, FileText, Code2, Eye, Bold, Italic, List, ListOrdered, Pilcrow, Smile, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ALLOWED_TAGS = ["p", "br", "ul", "ol", "li", "b", "strong", "i", "em"];

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
    if (tag === "div" || tag === "section" || tag === "article") mappedTag = "p";
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

  cleanRoot.querySelectorAll("p, li").forEach((node) => {
    const hasBreak = node.querySelector("br");
    const hasText = (node.textContent?.trim().length ?? 0) > 0;
    if (!hasText && !hasBreak) {
      node.remove();
    }
  });

  return cleanRoot.innerHTML
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

export default function AmazonHtmlConverter() {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [rawHtml, setRawHtml] = useState("");
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const [amazonHtml, setAmazonHtml] = useState("");
  const [formattedHtml, setFormattedHtml] = useState("");
  const [plainTextLength, setPlainTextLength] = useState(0);

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
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const runCommand = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value ?? "");
    setRawHtml(editorRef.current?.innerHTML || "");
  };

  const insertLineBreak = () => {
    restoreSelection();
    document.execCommand("insertHTML", false, "<br>");
    setRawHtml(editorRef.current?.innerHTML || "");
  };

  const insertEmoji = (emoji: string) => {
    restoreSelection();
    document.execCommand("insertText", false, emoji);
    setRawHtml(editorRef.current?.innerHTML || "");
    setEmojiOpen(false);
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
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      document.execCommand("insertHTML", false, "<br>");
    } else {
      document.execCommand("formatBlock", false, "p");
    }
    setRawHtml(editorRef.current?.innerHTML || "");
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
            <Button variant="outline" onClick={clearAll} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              清空内容
            </Button>
          </div>
        </section>

        <Card className="relative z-30 mb-5 overflow-visible rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 overflow-visible p-3">
            <span className="px-2 text-sm font-medium text-slate-500">格式工具</span>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button variant="ghost" size="sm" onClick={() => runCommand("formatBlock", "p")} className="rounded-xl">
              <Pilcrow className="mr-2 h-4 w-4" />普通段落
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button variant="ghost" size="sm" onClick={() => runCommand("bold")} className="rounded-xl">
              <Bold className="mr-2 h-4 w-4" />加粗
            </Button>
            <Button variant="ghost" size="sm" onClick={() => runCommand("italic")} className="rounded-xl">
              <Italic className="mr-2 h-4 w-4" />斜体
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button variant="ghost" size="sm" onClick={() => runCommand("insertUnorderedList")} className="rounded-xl">
              <List className="mr-2 h-4 w-4" />项目符号
            </Button>
            <Button variant="ghost" size="sm" onClick={() => runCommand("insertOrderedList")} className="rounded-xl">
              <ListOrdered className="mr-2 h-4 w-4" />编号列表
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button variant="ghost" size="sm" onClick={insertLineBreak} className="rounded-xl">插入换行</Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmojiOpen((open) => !open)}
                className="rounded-xl"
                aria-expanded={emojiOpen}
              >
                <Smile className="mr-2 h-4 w-4" />Emoji
              </Button>
              {emojiOpen ? (
                <div
                  className="absolute left-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
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
            <Button variant="ghost" size="sm" onClick={pasteAsPlainText} className="rounded-xl">
              <RotateCcw className="mr-2 h-4 w-4" />剪贴板转纯文本
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between border-b bg-white px-5 py-4">
              <div>
                <CardTitle className="text-base">粘贴文案</CardTitle>
                <p className="mt-1 text-xs text-slate-500">支持从 Word、飞书、网页或 ChatGPT 直接复制粘贴</p>
              </div>
              <Badge variant="outline" className="rounded-full">输入区</Badge>
            </CardHeader>
            <CardContent className="p-0">
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
                className="min-h-[420px] w-full bg-white px-5 py-4 text-sm leading-7 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
                data-placeholder="在这里粘贴产品描述、Bullet Points 或 A+ 文案..."
              />
              <div className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
                粘贴后会自动清理多余样式，仅保留亚马逊允许的基础 HTML 标签。
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between border-b bg-white px-5 py-4">
              <div>
                <CardTitle className="text-base">亚马逊 HTML</CardTitle>
                <p className="mt-1 text-xs text-slate-500">已过滤标题、样式、脚本和不推荐标签</p>
              </div>
              <Badge variant="outline" className="rounded-full">{plainTextLength} 字符</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="min-h-[420px] overflow-auto bg-slate-950 px-5 py-4 text-sm leading-6 text-slate-100">
                <code>{formattedHtml || "<!-- 转换后的 Amazon HTML 将显示在这里 -->"}</code>
              </pre>
              <div className="flex items-center justify-between border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
                <span>输出不生成 h1 / h2 / h3 等标题标签。</span>
                <button onClick={copyHtml} disabled={!formattedHtml} className="font-medium text-brand disabled:text-slate-400">复制代码</button>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 border-b pb-3 text-lg font-semibold text-slate-900">Product Description</h2>
              {amazonHtml ? (
                <div
                  className="amazon-preview text-sm leading-7 text-slate-800 [&_b]:font-semibold [&_i]:italic [&_li]:mb-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
                  dangerouslySetInnerHTML={{ __html: amazonHtml }}
                />
              ) : (
                <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                  预览内容将在这里显示
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">Amazon HTML Converter · Built for listing content cleanup</p>
      </main>
    </div>
  );
}
