export const route = $state({ path: location.pathname });

export function navigate(path: string): void {
  if (path === route.path) return;
  history.pushState(null, '', path);
  route.path = path;
}

window.addEventListener('popstate', () => {
  route.path = location.pathname;
});
