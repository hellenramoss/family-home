(() => {
  const enhanceHistoryForm = () => {
    const forms = document.querySelectorAll('.historyEntryForm');
    forms.forEach(form => {
      if (form.querySelector('[data-history-cancel]')) return;

      const title = form.querySelector('.pickerTitle');
      const scrim = form.closest('.pickerScrim');
      if (!title || !scrim) return;

      title.style.position = 'relative';
      title.style.minHeight = '44px';
      title.style.display = 'flex';
      title.style.alignItems = 'center';
      title.style.justifyContent = 'center';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.setAttribute('data-history-cancel', 'true');
      cancel.setAttribute('aria-label', 'Cancelar');
      cancel.textContent = '×';
      Object.assign(cancel.style, {
        position: 'absolute',
        left: '0',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '44px',
        height: '44px',
        border: '0',
        background: 'transparent',
        color: '#4f86f7',
        fontSize: '34px',
        fontWeight: '300',
        lineHeight: '1',
        cursor: 'pointer'
      });

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
