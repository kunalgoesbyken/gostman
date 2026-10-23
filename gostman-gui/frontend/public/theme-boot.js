(function () {
  var stored = {}
  try {
    stored = JSON.parse(localStorage.getItem('gostman.preferences')) || {}
  } catch (error) {
    stored = {}
  }
  var root = document.documentElement
  var follows = function (name) {
    return typeof stored[name] !== 'string' || stored[name] === 'system'
  }
  var isDark = follows('theme') ? matchMedia('(prefers-color-scheme: dark)').matches : stored.theme === 'dark'
  var wantsMoreContrast = follows('contrast') ? matchMedia('(prefers-contrast: more)').matches : stored.contrast === 'more'
  root.classList.toggle('dark', isDark)
  root.dataset.contrast = wantsMoreContrast ? 'more' : 'standard'
  if (typeof stored.accent === 'string') root.dataset.accent = stored.accent
  if (typeof stored.density === 'string') root.dataset.density = stored.density
  if (typeof stored.textScale === 'number') root.style.setProperty('--text-scale', stored.textScale)
})()
