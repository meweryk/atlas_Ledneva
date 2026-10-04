/* ============================================================
   atlas-ui.js — общая модалка alert/confirm для всего проекта.
   Заменяет системные alert() и confirm() на брендированные
   окна с шапкой «Атлас».
   • atlasAlert(msg)          — аналог alert()
   • atlasConfirm(msg)        — аналог confirm(), возвращает Promise<boolean>
   • window.alert автоматически переопределяется на atlasAlert
   • window.confirm НЕ переопределяется — используйте atlasConfirm + await
   ============================================================ */
(function() {
  'use strict';
  if (window.__atlasAlertInstalled) return;
  window.__atlasAlertInstalled = true;
  
  let overlay = null;
  let closeCallback = null;
  
  function ensureOverlay() {
    if (overlay) return overlay;
    
    overlay = document.createElement('div');
    overlay.id = 'atlasAlertOverlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:100000',
      'display:none', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.5)', 'padding:16px'
    ].join(';');
    
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'atlasAlertTitle');
    dialog.style.cssText = [
      'background:#fff', 'border-radius:12px', 'max-width:420px',
      'width:100%', 'box-shadow:0 10px 30px rgba(0,0,0,0.35)',
      'overflow:hidden', 'max-height:80vh',
      'display:flex', 'flex-direction:column'
    ].join(';');
    
    const header = document.createElement('div');
    header.id = 'atlasAlertTitle';
    header.textContent = 'Атлас';
    header.style.cssText = [
      'padding:14px 18px', 'background:#2d5a2d', 'color:#fff',
      'font-weight:600', 'font-size:1.05rem'
    ].join(';');
    
    const body = document.createElement('div');
    body.id = 'atlasAlertBody';
    body.style.cssText = [
      'padding:16px 18px', 'white-space:pre-wrap',
      'font-size:0.95rem', 'line-height:1.45',
      'overflow-y:auto', 'color:#222'
    ].join(';');
    
    const footer = document.createElement('div');
    footer.id = 'atlasAlertFooter';
    footer.style.cssText = 'padding:10px 18px 14px;text-align:right;';
    
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && typeof closeCallback === 'function') {
        closeCallback();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex' &&
        typeof closeCallback === 'function') {
        closeCallback();
      }
    });
    
    return overlay;
  }
  
  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
    closeCallback = null;
  }
  
  function makeButton(label, primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = primary ?
      'background:#2d5a2d;color:#fff;border:none;padding:8px 22px;border-radius:8px;font-size:0.95rem;cursor:pointer;margin-left:8px;' :
      'background:#eee;color:#222;border:none;padding:8px 18px;border-radius:8px;font-size:0.95rem;cursor:pointer;';
    return btn;
  }
  
  window.atlasAlert = function(message) {
    const el = ensureOverlay();
    el.querySelector('#atlasAlertTitle').textContent = 'Атлас';
    el.querySelector('#atlasAlertBody').textContent = String(message == null ? '' : message);
    
    const footer = el.querySelector('#atlasAlertFooter');
    footer.innerHTML = '';
    const okBtn = makeButton('OK', true);
    okBtn.addEventListener('click', hideOverlay);
    footer.appendChild(okBtn);
    
    closeCallback = hideOverlay;
    el.style.display = 'flex';
    setTimeout(() => okBtn.focus(), 50);
  };
  
  window.atlasConfirm = function(message) {
    return new Promise((resolve) => {
      const el = ensureOverlay();
      el.querySelector('#atlasAlertTitle').textContent = 'Атлас';
      el.querySelector('#atlasAlertBody').textContent = String(message == null ? '' : message);
      
      const footer = el.querySelector('#atlasAlertFooter');
      footer.innerHTML = '';
      const cancelBtn = makeButton('Отмена', false);
      const okBtn = makeButton('OK', true);
      footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
      
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        hideOverlay();
        resolve(result);
      };
      
      okBtn.addEventListener('click', () => finish(true));
      cancelBtn.addEventListener('click', () => finish(false));
      closeCallback = () => finish(false);
      
      el.style.display = 'flex';
      setTimeout(() => cancelBtn.focus(), 50);
    });
  };
  
  try {
    window.alert = window.atlasAlert;
  } catch (e) {
    console.warn('Не удалось переопределить alert:', e);
  }
})();