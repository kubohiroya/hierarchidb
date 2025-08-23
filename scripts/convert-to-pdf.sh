#!/bin/bash

# HTML to PDF conversion script
# This script provides instructions for converting the output HTML files to PDF

OUTPUT_DIR="docs/pdf"

echo "📄 HTML files are ready for PDF conversion:"
echo ""
echo "Generated files:"
echo "  - $OUTPUT_DIR/REPORT_EN.html"
echo "  - $OUTPUT_DIR/MANUAL_EN.html"
echo ""
echo "🔧 To convert to PDF, choose one of the following methods:"
echo ""
echo "Method 1: Browser Print-to-PDF (Recommended)"
echo "  1. Open the HTML files in your browser:"
echo "     file://$(pwd)/$OUTPUT_DIR/REPORT_EN.html"
echo "     file://$(pwd)/$OUTPUT_DIR/MANUAL_EN.html"
echo "  2. Press Ctrl+P (Cmd+P on Mac)"
echo "  3. Select 'Save as PDF' as destination"
echo "  4. Save as REPORT_EN.pdf and MANUAL_EN.pdf"
echo ""
echo "Method 2: Using wkhtmltopdf (if installed)"
echo "  brew install wkhtmltopdf"
echo "  wkhtmltopdf $OUTPUT_DIR/REPORT_EN.html $OUTPUT_DIR/REPORT_EN.pdf"
echo "  wkhtmltopdf $OUTPUT_DIR/MANUAL_EN.html $OUTPUT_DIR/MANUAL_EN.pdf"
echo ""
echo "Method 3: Using puppeteer (if available)"
echo "  npm install -g puppeteer"
echo "  npx puppeteer-pdf $OUTPUT_DIR/REPORT_EN.html $OUTPUT_DIR/REPORT_EN.pdf"
echo "  npx puppeteer-pdf $OUTPUT_DIR/MANUAL_EN.html $OUTPUT_DIR/MANUAL_EN.pdf"
echo ""

# Check if wkhtmltopdf is available and use it
if command -v wkhtmltopdf &> /dev/null; then
    echo "🚀 wkhtmltopdf found! Converting to PDF..."
    
    wkhtmltopdf \
        --page-size A4 \
        --margin-top 0.75in \
        --margin-right 0.75in \
        --margin-bottom 0.75in \
        --margin-left 0.75in \
        --encoding utf-8 \
        --enable-local-file-access \
        "$OUTPUT_DIR/REPORT_EN.html" \
        "$OUTPUT_DIR/REPORT_EN.pdf"
    
    wkhtmltopdf \
        --page-size A4 \
        --margin-top 0.75in \
        --margin-right 0.75in \
        --margin-bottom 0.75in \
        --margin-left 0.75in \
        --encoding utf-8 \
        --enable-local-file-access \
        "$OUTPUT_DIR/MANUAL_EN.html" \
        "$OUTPUT_DIR/MANUAL_EN.pdf"
    
    echo "✅ PDF conversion completed!"
    echo "📊 Generated PDFs:"
    if [ -f "$OUTPUT_DIR/REPORT_EN.pdf" ]; then
        echo "   - REPORT_EN.pdf: $(du -h "$OUTPUT_DIR/REPORT_EN.pdf" | cut -f1)"
    fi
    if [ -f "$OUTPUT_DIR/MANUAL_EN.pdf" ]; then
        echo "   - MANUAL_EN.pdf: $(du -h "$OUTPUT_DIR/MANUAL_EN.pdf" | cut -f1)"
    fi
else
    echo "📋 HTML files are ready. Please use one of the methods above to create PDFs."
fi