<script>
  import { Alert, Icon, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { buildCompletedNotification } from '$lib/services/builds/live-status';

  let showToast = $state(false);
  let build = $state(
    /** @type {import('$lib/services/builds/live-status').LiveBuild | null} */ (null),
  );

  // Subscribe to build completion notifications
  $effect(() => {
    const unsubscribe = buildCompletedNotification.subscribe((completedBuild) => {
      if (completedBuild) {
        build = completedBuild;
        showToast = true;

        // Auto-hide after 5 seconds
        setTimeout(() => {
          showToast = false;
        }, 5000);
      }
    });

    return unsubscribe;
  });
</script>

{#if showToast && build}
  <Toast bind:show={showToast}>
    <Alert status={build.conclusion === 'success' ? 'success' : 'error'}>
      <div style="display: flex; align-items: center; gap: 8px;">
        {#if build.conclusion === 'success'}
          <Icon name="check_circle" />
          <span>
            {$_('deploy_build_complete', { default: 'Deploy completed successfully!' })}
          </span>
        {:else}
          <Icon name="error" />
          <span>
            {$_('deploy_build_failed', { default: 'Deploy failed. Check the logs for details.' })}
          </span>
        {/if}
      </div>
    </Alert>
  </Toast>
{/if}
