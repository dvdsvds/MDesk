/** assets/theme.css의 data-theme 값과 같다 */
export type ThemeId =
  | 'paper-light'
  | 'paper-dark'
  | 'paper-warm-light'
  | 'paper-warm-dark'
  | 'gruvbox-light'
  | 'gruvbox-dark'
  | 'tokyo-night'
  | 'tokyo-night-light'
  | 'catppuccin-latte'
  | 'catppuccin-mocha'
  | 'nord'
  | 'dracula'
  | 'solarized-light'
  | 'solarized-dark'
  | 'one-dark'
  | 'rose-pine'
  | 'rose-pine-dawn'

export type ThemePreference = ThemeId

export interface ThemeOption {
  id: ThemeId
  name: string
  mode: 'light' | 'dark'
  /** 앱 기본 테마(Paper)인지. 처음 실행 때 고르는 창에는 이것만 보인다 */
  builtin?: boolean
  /** 목록에서 쓰는 색 견본: 배경, 글자, 강조 (assets/theme.css의 값과 같게 유지) */
  swatch: [bg: string, text: string, accent: string]
}

export const THEMES: ThemeOption[] = [
  {
    id: 'paper-light',
    name: 'Paper Light',
    mode: 'light',
    builtin: true,
    swatch: ['#ffffff', '#2b2b29', '#3b6cf0']
  },
  {
    id: 'paper-dark',
    name: 'Paper Dark',
    mode: 'dark',
    builtin: true,
    swatch: ['#191919', '#e6e6e3', '#6e9bff']
  },
  {
    id: 'paper-warm-light',
    name: 'Paper Warm Light',
    mode: 'light',
    builtin: true,
    swatch: ['#faf4e6', '#35312c', '#2f6f7a']
  },
  {
    id: 'paper-warm-dark',
    name: 'Paper Warm Dark',
    mode: 'dark',
    builtin: true,
    swatch: ['#262420', '#e8e0cf', '#7fb0a6']
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    mode: 'light',
    swatch: ['#fbf1c7', '#3c3836', '#076678']
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    mode: 'dark',
    swatch: ['#282828', '#ebdbb2', '#83a598']
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    swatch: ['#1a1b26', '#c0caf5', '#7aa2f7']
  },
  {
    id: 'tokyo-night-light',
    name: 'Tokyo Night Light',
    mode: 'light',
    swatch: ['#e1e2e7', '#343b58', '#34548a']
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    mode: 'light',
    swatch: ['#eff1f5', '#4c4f69', '#1e66f5']
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    swatch: ['#1e1e2e', '#cdd6f4', '#89b4fa']
  },
  { id: 'nord', name: 'Nord', mode: 'dark', swatch: ['#2e3440', '#eceff4', '#88c0d0'] },
  { id: 'dracula', name: 'Dracula', mode: 'dark', swatch: ['#282a36', '#f8f8f2', '#bd93f9'] },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    swatch: ['#fdf6e3', '#586e75', '#268bd2']
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    swatch: ['#002b36', '#93a1a1', '#268bd2']
  },
  { id: 'one-dark', name: 'One Dark', mode: 'dark', swatch: ['#282c34', '#abb2bf', '#61afef'] },
  { id: 'rose-pine', name: 'Rosé Pine', mode: 'dark', swatch: ['#191724', '#e0def4', '#c4a7e7'] },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    mode: 'light',
    swatch: ['#faf4ed', '#575279', '#907aa9']
  }
]

export const DEFAULT_LIGHT_THEME: ThemeId = 'paper-light'
export const DEFAULT_DARK_THEME: ThemeId = 'paper-dark'

export function findTheme(id: string): ThemeOption {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** OS의 밝기 설정에 맞는 기본 테마. 처음 실행 때 미리 골라 두는 값으로 쓴다 */
export function osDefaultTheme(): ThemeId {
  const dark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  return dark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
}
