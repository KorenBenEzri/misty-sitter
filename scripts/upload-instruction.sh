#!/usr/bin/env bash
# Usage: ./scripts/upload-instruction.sh <video_file> <task_name>
#
# 1. Runs whisper-cli on the video to produce transcription
# 2. Outputs the transcription text
# 3. Prints a template SQL INSERT for the instructions table
#
# Prerequisites:
#   - whisper-cli installed (brew install whisper-cpp or similar)

set -euo pipefail

VIDEO_FILE="${1:?Usage: $0 <video_file> <task_name>}"
TASK_NAME="${2:?Usage: $0 <video_file> <task_name>}"

# Escape single quotes for safe SQL interpolation
TASK_NAME_SQL=$(echo "$TASK_NAME" | sed "s/'/''/g")

if [ ! -f "$VIDEO_FILE" ]; then
  echo "Error: File '$VIDEO_FILE' not found"
  exit 1
fi

echo "🎙️  Running Whisper transcription on: $VIDEO_FILE"

# Extract audio if needed, run whisper
TRANSCRIPT=$(whisper-cli -f "$VIDEO_FILE" --output-txt 2>/dev/null || echo "[WHISPER FAILED]")

echo ""
echo "📝 Transcription:"
echo "---"
echo "$TRANSCRIPT"
echo "---"
echo ""
echo "📋 Template SQL INSERT:"
cat <<EOF
INSERT INTO public.instructions (title, description, task_id, video_path, transcript, steps, sort_order)
VALUES (
  '${TASK_NAME_SQL}',
  'TODO: summary',
  (SELECT id FROM tasks WHERE name ILIKE '%${TASK_NAME_SQL}%' LIMIT 1),
  'TODO.mp4',
  '$(echo "$TRANSCRIPT" | sed "s/'/''/g")',
  ARRAY['שלב 1: ...', 'שלב 2: ...'],
  0
);
EOF
