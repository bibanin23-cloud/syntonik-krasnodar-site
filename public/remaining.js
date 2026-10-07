// Keep screen 4 label lettering white above the bottles' background blending.
document.querySelectorAll('#about .about-products img').forEach((image,index)=>{
  const holder=image.parentElement;
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const filterId=`about-label-white-${index}`,clipId=`about-label-clip-${index}`;
  overlay.classList.add('about-label-whites');
  overlay.setAttribute('viewBox','0 0 1122 1402');
  overlay.setAttribute('aria-hidden','true');
  overlay.setAttribute('focusable','false');
  overlay.innerHTML=`<defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3 3 3 0 -6.5"/></filter><clipPath id="${clipId}"><rect x="300" y="548" width="514" height="564"/></clipPath></defs><image href="${image.getAttribute('src')}" width="1122" height="1402" filter="url(#${filterId})" clip-path="url(#${clipId})"/>`;
  holder.append(overlay);
  const alignLabel=()=>{
    const bottle=image.getBoundingClientRect(),frame=holder.getBoundingClientRect();
    const scale=Math.min(bottle.width/1122,bottle.height/1402);
    overlay.style.left=`${bottle.left-frame.left+(bottle.width-1122*scale)/2}px`;
    overlay.style.top=`${bottle.top-frame.top+bottle.height-1402*scale}px`;
    overlay.style.width=`${1122*scale}px`;
    overlay.style.height=`${1402*scale}px`;
  };
  new ResizeObserver(alignLabel).observe(image);
  image.addEventListener('load',alignLabel,{once:true});
  alignLabel();
});
const paths={
  molecule:'<path d="m7 20 7-4 7 4v8l-7 4-7-4Z M14 16V9m0 0 10 6m-3 9h7"/><circle cx="14" cy="6" r="3"/><circle cx="27" cy="16" r="3"/><circle cx="31" cy="24" r="3"/>',
  gear:'<path d="m15 3 6 0 1 5 4 2 4-2 3 5-3 4v5l3 3-3 6-5-2-4 2-1 4h-6l-1-4-4-2-5 2-3-6 3-3v-5l-3-4 3-5 4 2 4-2Z"/><circle cx="18" cy="19" r="6"/>',
  leaf:'<path d="M7 29C1 12 12 7 31 7c1 19-3 28-17 27M5 35l20-21"/>',
  bars:'<path d="M5 23h6v12H5Zm12-9h6v21h-6Zm12-11h6v32h-6Z"/>',
  drop:'<path d="M20 3C15 10 7 18 7 26a13 13 0 0 0 26 0C33 18 25 10 20 3Z"/>',
  wind:'<path d="M3 14h25c9 0 9-12 1-12-4 0-6 3-6 5M3 22h30c8 0 8 12 0 12-4 0-6-3-6-5M3 30h13"/>',
  flame:'<path d="M21 2c0 12-10 12-7 23 0 0-4-1-5-7-9 16 0 21 11 21 15 0 18-15 9-26 0 7-2 8-2 8C25 14 27 10 21 2Z"/>',
  factory:'<path d="M4 35V17l10 6V13l10 8V8h6v18h7v9ZM25 8V3h5v5M9 28v3m9-3v3m10-3v3"/>',
  flask:'<path d="M14 3h12m-10 0v15L6 33c-1 3 1 4 4 4h20c3 0 5-1 4-4L24 18V3M12 26h16M16 30h1m7 2h1"/>',
  document:'<path d="M8 3h16l8 8v26H8ZM24 3v9h8M13 19h14m-14 6h14m-14 6h10"/>',
  shield:'<path d="m20 3 14 6v12c0 8-6 12-14 17C12 33 6 29 6 21V9Z"/>',
  car:'<path d="m8 17 4-9h16l4 9M5 17h30v15H5ZM9 32v5m22-5v5M10 23h3m14 0h3M12 8h16"/>',
  engine:'<path d="M7 15h8l5-7h9l4 7h4v18H12l-5-6H3V16h4M22 8V3h7M3 20H1"/>',
  fuel:'<path d="M7 37V5h17v32M4 37h23M11 10h9v10h-9M24 15h5l6 7v11c0 6-6 6-6 0v-8M31 18v7h4"/>',
  question:'<circle cx="20" cy="20" r="16"/><path d="M14 15c0-8 13-8 13-1 0 5-7 5-7 10m0 6h.1"/>',
  trend:'<path d="m3 32 11-18 9 10L36 5"/>',
  sliders:'<path d="M3 9h12m6 0h16M3 20h22m6 0h6M3 31h5m6 0h23"/><circle cx="18" cy="9" r="3"/><circle cx="28" cy="20" r="3"/><circle cx="11" cy="31" r="3"/>',
  snow:'<path d="M20 2v36M4 11l32 18M4 29l32-18M14 6l6 4 6-4M14 34l6-4 6 4M4 18l7-3-1-7M30 32l-1-7 7-3M4 22l7 3-1 7M30 8l-1 7 7 3"/>',
  pin:'<path d="M20 37S7 24 7 15a13 13 0 0 1 26 0c0 9-13 22-13 22Z"/><circle cx="20" cy="15" r="5"/>',
  phone:'<path d="m9 3 7 9-4 6c3 5 6 8 11 11l6-4 8 7c-1 7-6 8-13 4C13 30 6 22 3 12c-2-6 0-9 6-9Z"/>',
  mail:'<path d="M3 7h34v26H3Zm0 0 17 14L37 7"/>'
};
const icon=name=>`<svg viewBox="0 0 40 40" aria-hidden="true">${paths[name]||paths.question}</svg>`;
document.querySelectorAll('[data-icon]').forEach(e=>{e.innerHTML=icon(e.dataset.icon);e.setAttribute('aria-hidden','true');});
const faqList=document.querySelector('#faq-list');
faqList.addEventListener('toggle',event=>{
  const item=event.target;
  if(item.matches('.faq-category')){
    if(item.open)faqList.querySelectorAll('.faq-category[open]').forEach(category=>{if(category!==item)category.open=false;});
    else item.querySelectorAll('.faq-item[open]').forEach(question=>{question.open=false;});
  }else if(item.matches('.faq-item')&&item.open){
    item.closest('.faq-category').querySelectorAll('.faq-item[open]').forEach(question=>{if(question!==item)question.open=false;});
  }
},true);
