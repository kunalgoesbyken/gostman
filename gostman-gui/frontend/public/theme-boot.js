(function () {
  var stored = {}
  try {
    stored = JSON.parse(localStorage.getItem('gostman.preferences')) || {}
  } catch (error) {
    stored = {}
  }
  var root = document.documentElement
  var chosen = function (name, explicit) {
    return explicit.indexOf(stored[name]) === -1 ? 'system' : stored[name]
  }
  var resolve = function (name, explicit, query) {
    var value = chosen(name, explicit)
    if (value !== 'system') return value
    return matchMedia(query).matches ? explicit[1] : explicit[0]
  }
  root.classList.toggle('dark', resolve('theme', ['light', 'dark'], '(prefers-color-scheme: dark)') === 'dark')
  root.dataset.contrast = resolve('contrast', ['standard', 'more'], '(prefers-contrast: more)')
  if (typeof stored.accent === 'string') root.dataset.accent = stored.accent
  if (typeof stored.density === 'string') root.dataset.density = stored.density
  if ([90, 100, 110, 125].indexOf(stored.textScale) !== -1) root.style.setProperty('--text-scale', stored.textScale)
})()
