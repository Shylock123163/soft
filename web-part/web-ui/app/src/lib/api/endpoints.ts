const defaultAssetApi = '';

export function getAssetApiBase() {
  return window.FILE_API_ENDPOINT || defaultAssetApi;
}

export function getOpenClawApiBase() {
  return `${window.location.origin}/api/sr/openclaw`;
}
