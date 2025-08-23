#!/bin/bash

# PDF生成スクリプト
# 使用前に pandoc と wkhtmltopdf をインストールしてください
# brew install pandoc wkhtmltopdf

set -e

# ディレクトリ設定
DOCS_DIR="docs"
OUTPUT_DIR="docs/pdf"
REPORT_DIR="$DOCS_DIR/REPORT"
MANUAL_DIR="$DOCS_DIR/MANUAL"

# 出力ディレクトリ作成
mkdir -p "$OUTPUT_DIR"

echo "🔄 Generating PDF documentation..."

# REPORT_EN.pdf の生成
echo "📄 Generating REPORT_EN.pdf..."
cat > "$OUTPUT_DIR/report_combined.md" << 'EOF'
% HierarchiDB Development Reports
% HierarchiDB Team
% $(date +"%Y-%m-%d")

EOF

# REPORTの主要文書を結合
echo "## Table of Contents" >> "$OUTPUT_DIR/report_combined.md"
echo "" >> "$OUTPUT_DIR/report_combined.md"

if [ -f "$REPORT_DIR/INDEX_EN.md" ]; then
    echo "### Development Reports Index" >> "$OUTPUT_DIR/report_combined.md"
    cat "$REPORT_DIR/INDEX_EN.md" >> "$OUTPUT_DIR/report_combined.md"
    echo "" >> "$OUTPUT_DIR/report_combined.md"
    echo "\\newpage" >> "$OUTPUT_DIR/report_combined.md"
    echo "" >> "$OUTPUT_DIR/report_combined.md"
fi

# 主要技術文書を追加
if [ -f "$REPORT_DIR/technical-architecture-specification.md" ]; then
    echo "### Technical Architecture Specification" >> "$OUTPUT_DIR/report_combined.md"
    cat "$REPORT_DIR/technical-architecture-specification.md" >> "$OUTPUT_DIR/report_combined.md"
    echo "" >> "$OUTPUT_DIR/report_combined.md"
    echo "\\newpage" >> "$OUTPUT_DIR/report_combined.md"
    echo "" >> "$OUTPUT_DIR/report_combined.md"
fi

# PDF生成
pandoc "$OUTPUT_DIR/report_combined.md" \
    -o "$OUTPUT_DIR/REPORT_EN.pdf" \
    --pdf-engine=wkhtmltopdf \
    --toc \
    --toc-depth=3 \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    -V papersize=a4 \
    --highlight-style=tango

# MANUAL_EN.pdf の生成
echo "📚 Generating MANUAL_EN.pdf..."
cat > "$OUTPUT_DIR/manual_combined.md" << 'EOF'
% HierarchiDB User Manual
% HierarchiDB Team
% $(date +"%Y-%m-%d")

EOF

# MANUALの主要文書を結合
echo "## Table of Contents" >> "$OUTPUT_DIR/manual_combined.md"
echo "" >> "$OUTPUT_DIR/manual_combined.md"

if [ -f "$MANUAL_DIR/INDEX_EN.md" ]; then
    echo "### User Manual Index" >> "$OUTPUT_DIR/manual_combined.md"
    cat "$MANUAL_DIR/INDEX_EN.md" >> "$OUTPUT_DIR/manual_combined.md"
    echo "" >> "$OUTPUT_DIR/manual_combined.md"
    echo "\\newpage" >> "$OUTPUT_DIR/manual_combined.md"
    echo "" >> "$OUTPUT_DIR/manual_combined.md"
fi

# 主要マニュアル文書を追加（番号順）
for file in "$MANUAL_DIR"/0*.md; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "00-index.md" ]; then
        echo "### $(basename "$file" .md | sed 's/^[0-9]*-//' | tr '-' ' ' | sed 's/\b\w/\U&/g')" >> "$OUTPUT_DIR/manual_combined.md"
        cat "$file" >> "$OUTPUT_DIR/manual_combined.md"
        echo "" >> "$OUTPUT_DIR/manual_combined.md"
        echo "\\newpage" >> "$OUTPUT_DIR/manual_combined.md"
        echo "" >> "$OUTPUT_DIR/manual_combined.md"
    fi
done

# PDF生成
pandoc "$OUTPUT_DIR/manual_combined.md" \
    -o "$OUTPUT_DIR/MANUAL_EN.pdf" \
    --pdf-engine=wkhtmltopdf \
    --toc \
    --toc-depth=3 \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    -V papersize=a4 \
    --highlight-style=tango

# クリーンアップ
rm "$OUTPUT_DIR/report_combined.md"
rm "$OUTPUT_DIR/manual_combined.md"

echo "✅ PDF generation completed!"
echo "📄 Generated files:"
echo "   - $OUTPUT_DIR/REPORT_EN.pdf"
echo "   - $OUTPUT_DIR/MANUAL_EN.pdf"

# ファイルサイズ表示
if [ -f "$OUTPUT_DIR/REPORT_EN.pdf" ]; then
    echo "📊 REPORT_EN.pdf: $(du -h "$OUTPUT_DIR/REPORT_EN.pdf" | cut -f1)"
fi

if [ -f "$OUTPUT_DIR/MANUAL_EN.pdf" ]; then
    echo "📊 MANUAL_EN.pdf: $(du -h "$OUTPUT_DIR/MANUAL_EN.pdf" | cut -f1)"
fi