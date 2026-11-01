export const EMOJIS = [
  '📄', '📝', '📌', '📎', '📚', '📖', '🗂️', '🗒️', '📅', '📊', '📈', '✅',
  '💡', '🚀', '🎯', '🔥', '⭐', '✨', '🎉', '🏆', '❤️', '💼', '🧠', '🛠️',
  '⚙️', '🔒', '🔑', '🌱', '🌍', '🏠', '✈️', '🍀', '☕', '🍕', '🎵', '🎨',
  '📷', '🎮', '💻', '📱', '🧪', '🧩', '🐛', '📦', '🗓️', '⏰', '💬', '👋',
  '😀', '😎', '🤔', '🙌', '👀', '🐱', '🐶', '🦄', '🌈', '☀️', '🌙', '⚡',
]

/** Preset covers: CSS backgrounds (no network access needed). */
export const COVERS = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #434343 0%, #000000 100%)',
  'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)',
  '#E3E2E0',
  '#EBF5FA',
]

/** Converts a stored cover value into a safe CSS background (see lib/sanitize). */
export { coverToCss } from '@/lib/sanitize'
