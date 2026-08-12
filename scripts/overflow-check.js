/*
Browser console script: copy & paste into the browser console on any page of your app.
It reports any elements whose rendered width exceeds window.innerWidth (possible horizontal overflow).
Usage:
1. Open the page to test (e.g., dashboard.html) in the browser.
2. Resize the browser to target device widths (320,360,375,390,414,430) or use device emulation.
3. Paste the contents of this file into the console and press Enter.

The script prints a concise report and highlights offending elements with a red outline.
*/
(function(){
  const report = [];
  const W = window.innerWidth || document.documentElement.clientWidth;
  const elements = Array.from(document.querySelectorAll('body *'));
  elements.forEach(el => {
    try{
      const rect = el.getBoundingClientRect();
      if(rect.width > W + 1){
        report.push({ el, width: Math.round(rect.width), selector: getSelector(el) });
      }
    }catch(e){}
  });

  if(report.length === 0){
    console.info('Overflow check OK — no elements wider than viewport ('+W+'px) found.');
    return;
  }

  console.warn('Found ' + report.length + ' element(s) wider than viewport ('+W+'px):');
  report.forEach((r, i) => {
    console.log(i+1 + ')', r.selector, '-', r.width + 'px', r.el);
    // highlight element
    r.el.style.outline = '3px solid rgba(255,0,0,0.8)';
    r.el.style.zIndex = 99999;
    r.el.scrollIntoView({behavior:'auto', block:'center'});
  });

  // Helper to build a short selector for reporting
  function getSelector(el){
    if(!el) return '';
    let parts = [];
    let node = el;
    let depth = 0;
    while(node && node.nodeType === 1 && depth < 4){
      let part = node.tagName.toLowerCase();
      if(node.id) part += '#' + node.id;
      else if(node.className && typeof node.className === 'string'){
        const cls = node.className.split(/\s+/).filter(Boolean)[0];
        if(cls) part += '.' + cls;
      }
      parts.push(part);
      node = node.parentElement;
      depth++;
    }
    return parts.reverse().join(' > ');
  }
})();
