(() => {
  const enhanceHistoryForm = () => {
    const forms = document.querySelectorAll('.historyEntryForm');
    forms.forEach(form => {
      if (form.querySelector('[data-history-cancel]')) return;

      const title = form.querySelector('.pickerTitle');
      const scrim = form.closest('.pickerScrim');
      if (!title || !scrim) return;

      title.classList.add('historyEntryTitle');

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.setAttribute('data-history-cancel', 'true');
      cancel.setAttribute('aria-label', 'Cancelar');
      cancel.className = 'historyEntryCancel';
      cancel.innerHTML = '&times;';
      cancel.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      title.prepend(cancel);
    });
  };

  const observer = new MutationObserver(enhanceHistoryForm);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceHistoryForm();
})();
