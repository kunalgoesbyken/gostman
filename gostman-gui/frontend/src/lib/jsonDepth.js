import { RESPONSE_TEXT } from './responseText'

export const DEPTH_ALL = 'all'
export const COLLAPSED_DEPTH = 1

const JSON_EXPANDED_DEPTH = 2
const MCP_EXPANDED_DEPTH = 3

const DEPTH_LEVELS = ['1', '2', '3', '4']
export const DEPTH_SETTINGS = [...DEPTH_LEVELS, DEPTH_ALL]

export const isDepthSetting = (setting) => DEPTH_SETTINGS.includes(setting)

export const depthOfSetting = (setting) => (setting === DEPTH_ALL ? Infinity : Number(setting))

export const settingOfDepth = (depth) => (depth === Infinity ? DEPTH_ALL : String(depth))

export const depthLabel = (setting) => (setting === DEPTH_ALL ? RESPONSE_TEXT.tree.allLevels : RESPONSE_TEXT.tree.level(Number(setting)))

export const appDefaultDepth = (isMcp) => (isMcp ? MCP_EXPANDED_DEPTH : JSON_EXPANDED_DEPTH)

export const requestDepth = (setting, isMcp) => (isDepthSetting(setting) ? depthOfSetting(setting) : appDefaultDepth(isMcp))
