git config --global --unset-all core.editor
git config --global core.editor "code --wait"


curl -sSL https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64 -o /tmp/hadolint
sudo mv /tmp/hadolint /usr/local/bin/hadolint
sudo chmod +x /usr/local/bin/hadolint

ZSHRC_FILE="$HOME/.zshrc"
CODE_TO_APPEND='
  PROMPT_EOL_MARK=""
  test -e "${HOME}/.iterm2_shell_integration.zsh" && source "${HOME}/.iterm2_shell_integration.zsh"
  precmd() { print -Pn "\e]133;D;%?\a" }
  preexec() { print -Pn "\e]133;C;\a" }
'
curl -L https://iterm2.com/shell_integration/zsh -o ~/.iterm2_shell_integration.zsh || true
echo "$CODE_TO_APPEND" >> "$ZSHRC_FILE"

# Make sure pnpm is available. Prefer corepack if present, otherwise fallback to npm install -g pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@latest --activate || true
  else
    npm install -g pnpm || true
  fi
fi

# Reload zsh configuration so subsequent commands in this script can use updated PATH
zsh -i -c "source ~/.zshrc"

# Install dependencies and run project bootstrap
pnpm install

npx nx run infras-tools:up





pnpm install

npx nx run-many -t up
