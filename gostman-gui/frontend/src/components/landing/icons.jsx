import { Icon } from "@iconify/react/offline"
import arrowRight from "@iconify-icons/solar/arrow-right-linear"
import check from "@iconify-icons/solar/check-read-linear"
import copy from "@iconify-icons/solar/copy-linear"
import download from "@iconify-icons/solar/download-linear"
import chevronDown from "@iconify-icons/solar/alt-arrow-down-linear"
import globe from "@iconify-icons/solar/global-linear"
import arrowUpRight from "@iconify-icons/solar/arrow-right-up-linear"
import github from "@iconify-icons/logos/github-icon"
import { cn } from "../../lib/utils"

const solar = (data) =>
  function SolarIcon({ className, ...props }) {
    return <Icon icon={data} className={className} aria-hidden="true" {...props} />
  }

export const ArrowRight = solar(arrowRight)
export const Check = solar(check)
export const Copy = solar(copy)
export const Download = solar(download)
export const ChevronDown = solar(chevronDown)
export const Globe = solar(globe)
export const ArrowUpRight = solar(arrowUpRight)

export function Github({ className, ...props }) {
  return <Icon icon={github} className={cn("brightness-0 invert", className)} aria-hidden="true" {...props} />
}
