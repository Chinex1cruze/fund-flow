// Lightweight toast utility
function showToast(message, type = 'info', timeout = 3500){
  const containerId = 'ff_toast_container';
  let container = document.getElementById(containerId);
  if(!container){
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(()=>{ toast.classList.add('visible'); }, 20);
  setTimeout(()=>{ toast.classList.remove('visible'); setTimeout(()=>toast.remove(),300); }, timeout);
  return toast;
}

// show loading on a button and return a function to restore
function setLoading(btn, loading=true){
  if(!btn) return ()=>{};
  if(loading){
    btn.dataset.prevText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Processing';
  } else {
    btn.disabled = false;
    if(btn.dataset.prevText) btn.innerHTML = btn.dataset.prevText;
  }
  return ()=>setLoading(btn, false);
}

window.showToast = showToast;
window.setLoading = setLoading;