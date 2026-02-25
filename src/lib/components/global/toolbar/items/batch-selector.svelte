<script>
  import { Select } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import {
    activeBatch,
    allBatches,
    batchModeEnabled,
    getSelectableBatches,
    setActiveBatch,
  } from '$lib/services/contents/workflow/batch';

  /**
   * Handle batch selection change.
   * @param {Event} event Select change event.
   */
  const handleBatchChange = (/** @type {Event} */ event) => {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    const batchId = select.value;
    if (batchId) {
      setActiveBatch(batchId);
    }
  };

  /** @type {import('$lib/components').SelectOption[]} */
  const batchOptions = $derived.by(() => {
    const batches = getSelectableBatches();
    return batches.map((b) => ({
      value: b.id,
      label: `${$_('batch', { default: 'Batch' })} (${b.entries.size})`,
    }));
  });

  /** Show selector only when batch mode is enabled and there are multiple batches */
  const showSelector = $derived(
    $batchModeEnabled && batchOptions.length > 1,
  );
</script>

{#if showSelector}
  <Select
    size="small"
    options={batchOptions}
    value={$activeBatch?.id ?? ''}
    onchange={handleBatchChange}
  />
{/if}
