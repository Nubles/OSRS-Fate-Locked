export const normalizeGeneratedText = (value) =>
  String(value).replace(/\r\n?/g, '\n');

export const generatedTextMatches = (actual, expected) =>
  normalizeGeneratedText(actual) === normalizeGeneratedText(expected);
