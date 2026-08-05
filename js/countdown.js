// simple countdown utility
function startCountdown(endsAt, el, onComplete){
  function tick(){
    const now = Date.now(); const diff = endsAt - now;
    if(diff <= 0){ el.textContent = '00:00:00'; if(onComplete) onComplete(); clearInterval(id); return; }
    const hrs = Math.floor(diff / (1000*60*60));
    const mins = Math.floor((diff % (1000*60*60)) / (1000*60));
    const secs = Math.floor((diff % (1000*60)) / 1000);
    el.textContent = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }
  tick(); const id = setInterval(tick, 1000); return id;
}
