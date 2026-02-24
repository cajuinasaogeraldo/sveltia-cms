<script>
  import { Button, Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { backend } from '$lib/services/backends';
  import {
    isLiveBuildRunning,
    liveBuildState,
    loadInitialState,
    refreshLiveBuilds,
    startLiveBuildPolling,
    stopLiveBuildPolling,
  } from '$lib/services/builds/live-status';

  /**
   * @import { LiveBuild } from '$lib/services/builds/live-status';
   */

  // Only show for remote GitHub backend (not local file system)
  const isRemoteGitHubBackend = $derived($backend?.isGit && $backend?.name === 'github');

  /** Whether the popup menu is open. */
  let isPopupOpen = $state(false);

  // Load initial state from localStorage when component mounts (no polling yet)
  $effect(() => {
    if (isRemoteGitHubBackend) {
      loadInitialState();
    }
  });

  // Start/stop polling based on popup open state or build running state
  $effect(() => {
    // Poll when popup is open OR when there's a build running
    if ((isPopupOpen || $isLiveBuildRunning) && isRemoteGitHubBackend) {
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

{#if isRemoteGitHubBackend}
  <MenuButton
    variant="ghost"
    popupPosition="bottom-right"
    aria-label={$_('deploy_status', { default: 'Deploy Status' })}
    onOpenChange={(/** @type {boolean} */ open) => {
      isPopupOpen = open;
    }}
  >
    {#snippet startIcon()}
      <span class="indicator" class:running={$isLiveBuildRunning}>
        {#if $isLiveBuildRunning}
          <div class="spinner-wrapper">
            <Icon name="sync" class="spinning" />
            <span class="pulse-dot"></span>
          </div>
        {:else if $liveBuildState.history[0]?.conclusion === 'success'}
          <Icon name="check_circle" />
        {:else if $liveBuildState.history[0]?.conclusion === 'failure'}
          <Icon name="error" />
        {:else}
          <Icon name="deployed_code" />
        {/if}
      </span>
    {/snippet}
    {#if $isLiveBuildRunning}
      <span class="deploy-text"
        >{$_('deploying', { default: 'Deploying' })}<span class="dots">...</span></span
      >
    {:else}
      {$_('deploy', { default: 'Deploy' })}
    {/if}
    {#snippet popup()}
      <Menu aria-label={$_('deploy_status', { default: 'Deploy Status' })}>
        <div role="none" class="menu-header">
          <span class="title">{$_('deploy_site', { default: 'Site Deployments' })}</span>
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
                <span class="build-name"
                  >{$_('deploying_site', { default: 'Deploying site...' })}</span
                >
                <span class="build-time">{$_('in_progress', { default: 'In progress' })}</span>
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
                  <span class="build-name">
                    {build.conclusion === 'success'
                      ? $_('deploy_successful', { default: 'Deploy successful' })
                      : build.conclusion === 'failure'
                        ? $_('deploy_failed', { default: 'Deploy failed' })
                        : $_('deploy_cancelled', { default: 'Deploy cancelled' })}
                  </span>
                  <span class="build-time">{formatRelativeTime(build.createdAt)}</span>
                </div>
                <Icon name="open_in_new" class="external-link" />
              </div>
            </MenuItem>
          {/each}
        {:else}
          <div role="none" class="empty-state">
            <span>{$_('no_recent_deploys', { default: 'No recent deployments' })}</span>
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
    position: relative;

    &.running {
      color: var(--sui-warning-foreground-color);
    }

    .spinner-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pulse-dot {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
      opacity: 0.6;
      animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }

    :global(.spinning) {
      animation: spin 1s linear infinite;
    }
  }

  .deploy-text {
    display: inline-flex;
    align-items: center;

    .dots {
      display: inline-flex;
      width: 1em;
      justify-content: space-between;

      &::after {
        content: '...';
        animation: dots-animation 1.5s steps(4, end) infinite;
      }
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

  @keyframes pulse-ring {
    0% {
      transform: scale(1);
      opacity: 0.6;
    }

    100% {
      transform: scale(2.5);
      opacity: 0;
    }
  }

  @keyframes dots-animation {
    0%,
    20% {
      content: '';
    }

    40% {
      content: '.';
    }

    60% {
      content: '..';
    }

    80%,
    100% {
      content: '...';
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
