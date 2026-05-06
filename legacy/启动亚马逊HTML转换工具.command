#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
HTML_FILE="$SCRIPT_DIR/index.html"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "没有找到工具页面：$HTML_FILE"
  echo "按回车键退出..."
  read -r
  exit 1
fi

/usr/bin/open "$HTML_FILE"
OPEN_STATUS=$?

if [[ $OPEN_STATUS -eq 0 ]]; then
  echo "已打开亚马逊 HTML 转换工具。"
else
  echo "打开失败，错误码：$OPEN_STATUS"
  echo "你也可以手动打开：$HTML_FILE"
fi

echo "按回车键关闭此窗口..."
read -r
