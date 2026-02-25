<script>
  import { _ } from 'svelte-i18n';

  import {
    batchModeEnabled,
    disableBatchMode,
    enableBatchMode,
  } from '$lib/services/contents/workflow/batch';

  /**
   * Handle batch mode toggle.
   * @param {boolean} enabled Whether batch mode is being enabled.
   */
  const handleToggle = async (enabled) => {
    if (enabled) {
      await enableBatchMode();
    } else {
      disableBatchMode();
    }
  };
</script>

<button
  type="button"
  class="sui sui-button sui-iconic sui-tertiary sui-small"
  class:active={$batchModeEnabled}
  aria-label={$_('batch_mode', { default: 'Batch Mode' })}
  aria-pressed={$batchModeEnabled}
  title={$_('batch_mode', { default: 'Batch Mode' })}
  onclick={() => handleToggle(!$batchModeEnabled)}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"
    />
    <path d="M7 10h2v7H7zm4-3h2v10h-2zm4-3h2v13h-2z" />
  </svg>
</button>

<style lang="scss">
  button.active {
    color: var(--sui-primary-accent-color);
  }
</style>
