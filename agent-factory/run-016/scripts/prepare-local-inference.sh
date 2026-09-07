#!/usr/bin/env bash
set -euo pipefail

ROOT="${RUN016_LOCAL_ROOT:-$PWD/.run016-local}"
MODEL_DIR="$ROOT/models"
SRC_DIR="$ROOT/src"
BIN_DIR="$ROOT/bin"
mkdir -p "$MODEL_DIR" "$SRC_DIR" "$BIN_DIR"

LLAMA_TAG="v0.4.0"
LLAMA_COMMIT="5266f24da75dc449bd56cbed7addb9c8e4a6a73e"
LLAMA_SRC="$SRC_DIR/llama.cpp"
LLAMA_SERVER="$BIN_DIR/llama-server"

SPECIALIST_FILE="$MODEL_DIR/SmolLM3-Q4_K_M.gguf"
SPECIALIST_SHA="8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e"
SPECIALIST_URL="https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/4965cb60b150737b68a0408c36aeefb65078f894/SmolLM3-Q4_K_M.gguf?download=true"

REVIEWER_FILE="$MODEL_DIR/Qwen3-4B-Q4_K_M.gguf"
REVIEWER_SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
REVIEWER_URL="https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/a9a60d009fa7ff9606305047c2bf77ac25dbec49/Qwen3-4B-Q4_K_M.gguf?download=true"

verify_file() {
  local file="$1"
  local expected="$2"
  [[ -f "$file" ]] || return 1
  local actual
  actual=$(sha256sum "$file" | awk '{print $1}')
  [[ "$actual" == "$expected" ]]
}

download_verified() {
  local url="$1"
  local file="$2"
  local expected="$3"
  if verify_file "$file" "$expected"; then
    echo "Verified cached model: $file"
    return 0
  fi
  rm -f "$file" "$file.part"
  echo "Downloading pinned model: $(basename "$file")"
  curl --fail --location --retry 5 --retry-delay 3 --retry-all-errors \
    --output "$file.part" "$url"
  mv "$file.part" "$file"
  if ! verify_file "$file" "$expected"; then
    echo "SHA256 verification failed for $file" >&2
    exit 21
  fi
}

if [[ ! -x "$LLAMA_SERVER" ]]; then
  rm -rf "$LLAMA_SRC"
  git clone --quiet --depth 1 --branch "$LLAMA_TAG" https://github.com/ggml-org/llama.cpp.git "$LLAMA_SRC"
  ACTUAL_COMMIT=$(git -C "$LLAMA_SRC" rev-parse HEAD)
  if [[ "$ACTUAL_COMMIT" != "$LLAMA_COMMIT" ]]; then
    echo "llama.cpp tag resolved to unexpected commit: $ACTUAL_COMMIT" >&2
    exit 22
  fi
  cmake -S "$LLAMA_SRC" -B "$LLAMA_SRC/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_EXAMPLES=OFF \
    -DLLAMA_BUILD_SERVER=ON >/dev/null
  cmake --build "$LLAMA_SRC/build" --config Release --target llama-server -j2
  cp "$LLAMA_SRC/build/bin/llama-server" "$LLAMA_SERVER"
  chmod +x "$LLAMA_SERVER"
fi

"$LLAMA_SERVER" --version | head -n 2 || true

download_verified "$SPECIALIST_URL" "$SPECIALIST_FILE" "$SPECIALIST_SHA"
download_verified "$REVIEWER_URL" "$REVIEWER_FILE" "$REVIEWER_SHA"

cat > "$ROOT/runtime.json" <<JSON
{
  "schemaVersion": "1.0",
  "llamaCppTag": "$LLAMA_TAG",
  "llamaCppCommit": "$LLAMA_COMMIT",
  "llamaServer": "$LLAMA_SERVER",
  "specialistModel": "$SPECIALIST_FILE",
  "specialistSha256": "$SPECIALIST_SHA",
  "reviewerModel": "$REVIEWER_FILE",
  "reviewerSha256": "$REVIEWER_SHA"
}
JSON

echo "Run 016 local inference runtime prepared and cryptographically verified."
