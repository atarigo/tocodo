// 讓 tsc 認得 .svelte 匯入；元件內部的型別檢查交給 svelte-check
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<Record<string, never>>;
  export default component;
}
