export function generateHMRBlock(componentExports: string[]): string {
  if (componentExports.length === 0) {
    return "";
  }

  const updates = componentExports
    .map(
      (name) => `
    if (newModule.${name} && window.__shadejs_registry__?.has("${name}")) {
      window.__shadejs_registry__.get("${name}")(newModule.${name});
    }`
    )
    .join("");

  return `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (!newModule) return${updates}
  });
}
`;
}
