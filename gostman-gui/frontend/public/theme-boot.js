(function () {
  var theme = 'system'
  try {
    var stored = JSON.parse(localStorage.getItem('gostman.preferences'))
    if (stored && typeof stored.theme === 'string') theme = stored.theme
  } catch (error) {
    theme = 'system'
  }
  var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  var isDark = theme === 'dark' || (theme !== 'light' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
})()
