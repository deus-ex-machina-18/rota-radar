export function searchApiKey() {
  return process.env.SEARCHAPI_API_KEY?.trim() ?? "";
}
