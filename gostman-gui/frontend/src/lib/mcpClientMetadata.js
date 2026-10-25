import { OAUTH_CALLBACK_PATH } from './backend/oauthPopup.js'

export const CLIENT_METADATA_PATH = '/oauth/client-metadata.json'
const DESKTOP_REDIRECT_URIS = ['http://localhost:9876/callback', 'http://127.0.0.1:9876/callback']

export const clientMetadataUrl = (siteUrl) => `${siteUrl}${CLIENT_METADATA_PATH}`

const redirectUris = (siteUrl) => [...DESKTOP_REDIRECT_URIS, `${siteUrl}${OAUTH_CALLBACK_PATH}`]

export const clientMetadata = (siteUrl) => ({
  client_id: clientMetadataUrl(siteUrl),
  client_name: 'Gostman',
  client_uri: siteUrl,
  redirect_uris: redirectUris(siteUrl),
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
})

export const metadataUrlFor = (siteUrl, redirectUri) => (redirectUris(siteUrl).includes(redirectUri) ? clientMetadataUrl(siteUrl) : '')
