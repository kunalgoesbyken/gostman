import { localizedText } from './localized'

export const errorBodyOf = (response) => localizedText(response.localized, response.body)
