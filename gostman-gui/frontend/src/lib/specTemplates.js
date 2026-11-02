import blank from './specTemplates/blank.yaml?raw'
import resource from './specTemplates/resource.yaml?raw'
import strategies from './specTemplates/strategies.yaml?raw'

export const SPEC_TEMPLATES = { strategies, resource, blank }

export const TEMPLATE_IDS = Object.keys(SPEC_TEMPLATES)

export const DEFAULT_TEMPLATE = TEMPLATE_IDS[0]
