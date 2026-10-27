/* JFB Tools: shared behaviour for the header "steps" row on phones.
   Makes it obvious that the row scrolls: dots show where you are, and the row
   gives one small sideways nudge the first time per visit. */
(function(){
  var steps=document.getElementById('steps');
  if(!steps||!window.matchMedia||!window.matchMedia('(max-width:600px)').matches) return;
  var pills=steps.querySelectorAll('.step'); if(pills.length<2) return;

  var dots=document.createElement('div');
  dots.className='steps-dots'; dots.setAttribute('aria-hidden','true');
  for(var i=0;i<pills.length;i++) dots.appendChild(document.createElement('i'));
  steps.parentNode.insertBefore(dots,steps.nextSibling);

  function update(){
    var max=steps.scrollWidth-steps.clientWidth;
    var idx=max>0?Math.round(steps.scrollLeft/max*(pills.length-1)):0;
    for(var k=0;k<dots.children.length;k++) dots.children[k].className=(k===idx?'on':'');
  }
  steps.addEventListener('scroll',update,{passive:true});
  update();

  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen=false; try{ seen=!!sessionStorage.getItem('jfb-steps-peek'); }catch(e){}
  if(!reduce&&!seen&&!steps.classList.contains('hidden')){
    try{ sessionStorage.setItem('jfb-steps-peek','1'); }catch(e){}
    setTimeout(function(){ if(steps.scrollLeft===0&&steps.scrollTo) steps.scrollTo({left:96,behavior:'smooth'}); },900);
    setTimeout(function(){ if(steps.scrollLeft>0&&steps.scrollLeft<=110&&steps.scrollTo) steps.scrollTo({left:0,behavior:'smooth'}); },2100);
  }
})();
