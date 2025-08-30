#!/bin/bash

echo "Fixing WebStorm VCS tracking issue..."
echo "======================================="

# Check current Git status
echo "1. Git Repository Status:"
git status --short
if [ $? -eq 0 ]; then
    echo "✓ Git repository is clean"
fi

# Count tracked files
TRACKED_COUNT=$(git ls-files | wc -l | tr -d ' ')
echo "✓ Git tracks $TRACKED_COUNT files"

# Count ignored files  
IGNORED_COUNT=$(git status --ignored --porcelain | wc -l | tr -d ' ')
echo "✓ Git ignores $IGNORED_COUNT files"

echo ""
echo "2. WebStorm VCS Fix Steps:"
echo "   To fix WebStorm showing incorrect untracked files:"
echo ""
echo "   Option A - Clear WebStorm cache (Recommended):"
echo "   1. In WebStorm: File → Invalidate Caches..."
echo "   2. Check: 'Clear file system cache and Local History'"
echo "   3. Check: 'Clear VCS Log caches and indexes'"
echo "   4. Click 'Invalidate and Restart'"
echo ""
echo "   Option B - Re-initialize VCS:"
echo "   1. In WebStorm: VCS → Enable Version Control Integration..."
echo "   2. Select 'Git' and click OK"
echo "   3. If already enabled, try: VCS → Git → Refresh File Status"
echo ""
echo "   Option C - Manual refresh:"
echo "   1. Close WebStorm"
echo "   2. Delete .idea/vcs.xml"
echo "   3. Restart WebStorm"
echo "   4. WebStorm will re-detect Git automatically"
echo ""

# Check for actual untracked files that should be in .gitignore
echo "3. Files that might need to be added to .gitignore:"
if [ -f "e2e-results.json" ] || [ -f "e2e-results.xml" ]; then
    echo "   - e2e-results.json"
    echo "   - e2e-results.xml"
fi
if [ -d "app/.react-router" ]; then
    echo "   - app/.react-router/"
fi

echo ""
echo "4. Verification:"
echo "   After fixing, WebStorm should show:"
echo "   - No untracked files (or very few)"
echo "   - Same file count as Git ($TRACKED_COUNT tracked files)"