const OPEN_MENU_OPENER = '[aria-haspopup="menu"][aria-expanded="true"]'

export const isOpenMenuOpener = (target) => Boolean(target.closest?.(OPEN_MENU_OPENER))
