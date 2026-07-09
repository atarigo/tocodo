<script lang="ts">
  import { marked } from 'marked';
  import { navigate } from './router.svelte.js';

  const mdModules = import.meta.glob('/spec/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const yamlModules = import.meta.glob('/src/data/content/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  type EntryKind = 'md' | 'yaml';

  interface SpecEntry {
    path: string;
    label: string;
    content: string;
    kind: EntryKind;
  }

  const specEntries: SpecEntry[] = Object.entries(mdModules)
    .map(([path, content]) => ({
      path,
      label: path.split('/').pop()!.replace(/\.md$/, ''),
      content: content as string,
      kind: 'md' as const,
    }))
    .sort((a, b) => {
      if (a.label === 'README') return -1;
      if (b.label === 'README') return 1;
      return a.label.localeCompare(b.label);
    });

  const dataEntries: SpecEntry[] = Object.entries(yamlModules)
    .map(([path, content]) => ({
      path,
      label: path.split('/').pop()!.replace(/\.yaml$/, ''),
      content: content as string,
      kind: 'yaml' as const,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  let selected = $state(specEntries[0]);

  function rendered(): string {
    if (selected.kind === 'md') {
      return marked.parse(selected.content, { async: false }) as string;
    }
    return '';
  }
</script>

<div class="spec-layout">
  <nav class="spec-sidebar">
    <div class="spec-sidebar-header">
      <a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>← 返回</a>
    </div>

    <div class="spec-sidebar-group">規格文件</div>
    <ul>
      {#each specEntries as entry}
        <li>
          <button
            class="spec-nav-btn"
            class:active={selected.path === entry.path}
            onclick={() => selected = entry}
          >
            {entry.label}
          </button>
        </li>
      {/each}
    </ul>

    <div class="spec-sidebar-group">遊戲資料</div>
    <ul>
      {#each dataEntries as entry}
        <li>
          <button
            class="spec-nav-btn"
            class:active={selected.path === entry.path}
            onclick={() => selected = entry}
          >
            {entry.label}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <main class="spec-content">
    {#if selected.kind === 'md'}
      <div class="markdown-body">
        {@html rendered()}
      </div>
    {:else}
      <pre class="yaml-body">{selected.content}</pre>
    {/if}
  </main>
</div>
