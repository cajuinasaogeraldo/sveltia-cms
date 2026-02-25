<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { dialogState, closeDialog } from './confirm-dialog.js';
</script>

{#if $dialogState.show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="dialog-overlay"
    onkeydown={(e) => e.key === 'Escape' && closeDialog()}
    onclick={closeDialog}
    role="presentation"
  >
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
      tabindex="-1"
    >
      <h3 id="dialog-title">{$dialogState.title}</h3>
      <p id="dialog-message">{$dialogState.message}</p>
      <div class="actions">
        <Button variant="tertiary" onclick={closeDialog}>
          {$_('cancel', { default: 'Cancel' })}
        </Button>
        <Button
          variant="primary"
          onclick={() => {
            $dialogState.onConfirm();
          }}
        >
          {$_('confirm', { default: 'Confirm' })}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .dialog {
    background-color: var(--sui-primary-background-color);
    border-radius: 12px;
    padding: 24px;
    max-width: 480px;
    width: calc(100% - 32px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);

    &:focus {
      outline: 2px solid var(--sui-primary-accent-color);
    }
  }

  h3 {
    margin: 0 0 16px;
    font-size: var(--sui-font-size-x-large);
    color: var(--sui-primary-foreground-color);
  }

  p {
    margin: 0 0 24px;
    color: var(--sui-secondary-foreground-color);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
