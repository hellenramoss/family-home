(() => {
  const closeHistoryEntry = scrim => {
    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  const enhanceHistoryForm = () => {
    const forms = document.querySelectorAll('.historyEntryForm');
    document.body.classList.toggle('historyEntryActive', forms.length > 0);

    forms.forEach(form => {
      const scrim = form.closest('.pickerScrim');
      const title = form.querySelector('.pickerTitle');
      if (!scrim || !title) return;

      scrim.classList.add('historyEntryScrim');
      form.setAttribute('role', 'dialog');
      form.setAttribute('aria-modal', 'true');
      form.setAttribute('aria-label', 'Registrar compra anterior');

      if (form.querySelector('[data-history-cancel]')) return;

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.setAttribute('data-history-cancel', 'true');
      cancel.setAttribute('aria-label', 'Cancelar e fechar');
      cancel.className = 'historyEntryCancel';
      cancel.textContent = '×';
      cancel.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        closeHistoryEntry(scrim);
      });

      title.prepend(cancel);
    });
  };

  const observer = new MutationObserver(enhanceHistoryForm);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceHistoryForm();
})();
