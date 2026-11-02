import { REQUEST_SETTINGS_TEXT as TEXT } from './requestSettingsText'

export const HTTP_VERSION_CHOICES = [
  { value: '', get label() { return TEXT.httpVersions.auto } },
  { value: '1.1', get label() { return TEXT.httpVersions.http11 } },
  { value: '2', get label() { return TEXT.httpVersions.http2 } },
]

export const RPC_TRANSPORT_CHOICES = [
  { value: '', get label() { return TEXT.rpcTransports.grpc } },
  { value: 'grpc-web', get label() { return TEXT.rpcTransports.grpcWeb } },
  { value: 'grpc-web-text', get label() { return TEXT.rpcTransports.grpcWebText } },
  { value: 'connect', get label() { return TEXT.rpcTransports.connect } },
]

export const isChoice = (choices, value) => choices.some((choice) => choice.value === value)
