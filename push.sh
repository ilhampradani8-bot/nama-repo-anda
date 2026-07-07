#!/bin/bash

# Simple script to commit and push changes to GitHub
# Usage: ./push.sh "Your commit message"

# Get the commit message, default to a timestamped message if empty
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="update: changes made at $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "======= Starting Push Process ======="
echo "Commit Message: $COMMIT_MSG"
echo "-------------------------------------"

# 1. Add all changes
echo "Adding changes..."
git add .

# 2. Commit changes
echo "Committing..."
if git commit -m "$COMMIT_MSG"; then
    echo "Changes committed successfully."
else
    echo "No changes to commit or commit failed."
fi

# 3. Push to GitHub
echo "Pushing to GitHub..."
if git push origin master; then
    echo "====================================="
    echo "✅ Success! All changes pushed to GitHub."
    echo "====================================="
else
    echo "====================================="
    echo "❌ Error! Failed to push to GitHub."
    echo "====================================="
    exit 1
fi
