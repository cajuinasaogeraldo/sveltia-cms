<script>
  import { Button, Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { onDestroy, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import { backend } from '$lib/services/backends';
  import {
    isLiveBuildRunning,
    liveBuildState,
    refreshLiveBuilds,
    startLiveBuildPolling,
    stopLiveBuildPolling,
  } from '$lib/services/builds/live-status';

  /**
   * @import { LiveBuild } from '$lib/services/builds/live-status';
   */

  const isGitHubBackend = $derived($backend?.isGit && $backend?.name === 'github');

  onMount(() => {
    if (isGitHubBackend) {
      startLiveBuildPolling();
    }
  });

  onDestroy(() => {
    stopLiveBuildPolling();
  });

  // Start/stop polling based on backend
  $effect(() => {
    if (isGitHubBackend) {
      startLiveBuildPolling();
    } else {
      stopLiveBuildPolling();
    }
  });

  /**
   * Format relative time.
   * @param {string} dateString ISO date string.
   * @returns {string} Relative time string.
   */
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return $_('just_now', { default: 'Just now' });
    }

    if (diffMins < 60) {
      return $_('minutes_ago', { default: '{mins}m ago', values: { mins: diffMins } });
    }

    if (diffHours < 24) {
      return $_('hours_ago', { default: '{hours}h ago', values: { hours: diffHours } });
    }

    return $_('days_ago', { default: '{days}d ago', values: { days: diffDays } });
  };

  /**
   * Get status icon name.
   * @param {LiveBuild} build Build object.
   * @returns {string} Icon name.
   */
  const getStatusIcon = (build) => {
    if (build.status === 'in_progress' || build.status === 'queued') {
      return 'sync';
    }

    if (build.conclusion === 'success') {
      return 'check_circle';
    }

    if (build.conclusion === 'failure') {
      return 'error';
    }

    if (build.conclusion === 'cancelled') {
      return 'cancel';
    }

    return 'help';
  };

  /**
   * Get status color class.
   * @param {LiveBuild} build Build object.
   * @returns {string} Color class.
   */
  const getStatusClass = (build) => {
    if (build.status === 'in_progress' || build.status === 'queued') {
      return 'running';
    }

    if (build.conclusion === 'success') {
      return 'success';
    }

    if (build.conclusion === 'failure') {
      return 'failure';
    }

    return 'neutral';
  };

  /**
   * Open build URL in new tab.
   * @param {LiveBuild} build Build object.
   */
  const openBuild = (build) => {
    globalThis.open(build.htmlUrl, '_blank');
  };

  /**
   * Handle refresh click.
   */
  const handleRefresh = async () => {
    await refreshLiveBuilds();
  };
</script>

{#if isGitHubBackend}
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={$_('live_build_status', { default: 'Live Build Status' })}
  >
    {#snippet endIcon()}
      <span class="indicator" class:running={$isLiveBuildRunning}>
        {#if $isLiveBuildRunning}
          <Icon name="sync" class="spinning" />
        {:else if $liveBuildState.history[0]?.conclusion === 'success'}
          <Icon name="check_circle" />
        {:else if $liveBuildState.history[0]?.conclusion === 'failure'}
          <Icon name="error" />
        {:else}
          <Icon name="deployed_code" />
        {/if}
      </span>
    {/snippet}
    {#snippet popup()}
      <Menu aria-label={$_('live_build_status', { default: 'Live Build Status' })}>
        <div role="none" class="menu-header">
          <span class="title">{$_('live_builds', { default: 'Live Builds (main)' })}</span>
          <Button
            variant="ghost"
            size="small"
            iconic
            aria-label={$_('refresh', { default: 'Refresh' })}
            onclick={handleRefresh}
          >
            <Icon name="refresh" />
          </Button>
        </div>
        <Divider />
        {#if $isLiveBuildRunning && $liveBuildState.currentBuild}
          {@const build = $liveBuildState.currentBuild}
          <MenuItem onclick={() => openBuild(build)}>
            <div role="none" class="build-item {getStatusClass(build)}">
              <Icon name={getStatusIcon(build)} class="status-icon spinning" />
              <div role="none" class="build-info">
                <span class="build-name">{build.name}</span>
                <span class="build-time">{$_('building', { default: 'Building...' })}</span>
              </div>
              <Icon name="open_in_new" class="external-link" />
            </div>
          </MenuItem>
          <Divider />
        {/if}
        {#if $liveBuildState.history.length > 0}
          {#each $liveBuildState.history as build (build.id)}
            <MenuItem onclick={() => openBuild(build)}>
              <div role="none" class="build-item {getStatusClass(build)}">
                <Icon name={getStatusIcon(build)} class="status-icon" />
                <div role="none" class="build-info">
                  <span class="build-name">{build.name}</span>
                  <span class="build-time">{formatRelativeTime(build.createdAt)}</span>
                </div>
                <Icon name="open_in_new" class="external-link" />
              </div>
            </MenuItem>
          {/each}
        {:else}
          <div role="none" class="empty-state">
            <span>{$_('no_recent_builds', { default: 'No recent builds' })}</span>
          </div>
        {/if}
      </Menu>
    {/snippet}
  </MenuButton>
{/if}

<style lang="scss">
  .indicator {
    display: flex;
    align-items: center;
    justify-content: center;

    &.running {
      color: var(--sui-warning-foreground-color);
    }

    :global(.spinning) {
      animation: spin 1s linear infinite;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    gap: 8px;

    .title {
      font-weight: 600;
      font-size: 0.875rem;
    }
  }

  .build-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 200px;

    :global(.status-icon) {
      flex-shrink: 0;
    }

    &.running :global(.status-icon) {
      color: var(--sui-warning-foreground-color);
    }

    &.success :global(.status-icon) {
      color: var(--sui-success-foreground-color);
    }

    &.failure :global(.status-icon) {
      color: var(--sui-error-foreground-color);
    }

    .build-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;

      .build-name {
        font-size: 0.875rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .build-time {
        font-size: 0.75rem;
        color: var(--sui-secondary-foreground-color);
      }
    }

    :global(.external-link) {
      flex-shrink: 0;
      opacity: 0.5;
    }
  }

  .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--sui-secondary-foreground-color);
    font-size: 0.875rem;
  }
</style>
