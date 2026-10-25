import { SvgIcon } from "../ui/svgIcon"
import arrowRight from "@iconify-icons/solar/arrow-right-linear"
import check from "@iconify-icons/solar/check-read-linear"
import copy from "@iconify-icons/solar/copy-linear"
import download from "@iconify-icons/solar/download-linear"
import chevronDown from "@iconify-icons/solar/alt-arrow-down-linear"
import globe from "@iconify-icons/solar/global-linear"
import arrowUpRight from "@iconify-icons/solar/arrow-right-up-linear"
import arrowLeft from "@iconify-icons/solar/arrow-left-linear"
import chevronRight from "@iconify-icons/solar/alt-arrow-right-linear"
import magnifer from "@iconify-icons/solar/magnifer-linear"
import hamburger from "@iconify-icons/solar/hamburger-menu-linear"
import closeCircle from "@iconify-icons/solar/close-circle-linear"
import sun from "@iconify-icons/solar/sun-linear"
import moon from "@iconify-icons/solar/moon-linear"
import monitor from "@iconify-icons/solar/monitor-linear"
import pen from "@iconify-icons/solar/pen-new-square-linear"
import list from "@iconify-icons/solar/list-linear"

const solar = (data) =>
  function SolarIcon({ className }) {
    return <SvgIcon icon={data} className={className} />
  }

export const ArrowRight = solar(arrowRight)
export const Check = solar(check)
export const Copy = solar(copy)
export const Download = solar(download)
export const ChevronDown = solar(chevronDown)
export const Globe = solar(globe)
export const ArrowUpRight = solar(arrowUpRight)
export const ArrowLeft = solar(arrowLeft)
export const ChevronRight = solar(chevronRight)
export const Search = solar(magnifer)
export const Menu = solar(hamburger)
export const Close = solar(closeCircle)
export const Sun = solar(sun)
export const Moon = solar(moon)
export const Monitor = solar(monitor)
export const Pen = solar(pen)
export const List = solar(list)
