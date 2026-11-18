import { lazy } from "react"

export const lazyExport = (load, name) => lazy(() => load().then((module) => ({ default: module[name] })))
