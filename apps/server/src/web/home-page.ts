export function renderHomePage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>纳知库 · Link2Obsidian</title>
<link rel="icon" href="/favicon.png">
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#22312b;background:#f5f7f6;font-size:14px}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.55}
main{max-width:1080px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:40px;height:40px}h1{font-size:20px;margin:0}h2{font-size:16px;margin:0}p{color:#76827c;line-height:1.6;margin:5px 0}
.version{font-size:11px;background:#e6efea;border-radius:5px;padding:3px 6px;color:#48705b}
.card{background:white;border:1px solid #e1e7e3;border-radius:12px;padding:22px;margin-bottom:20px;box-shadow:0 3px 12px #20382b03}
.token{display:flex;gap:7px;align-items:center}.token input{width:170px}
input,textarea,select{border:1px solid #d9e1dc;border-radius:7px;background:white;padding:9px 11px;color:#22312b}
input:focus,textarea:focus,select:focus{outline:2px solid #a8cbb9;outline-offset:1px}textarea{width:100%;min-height:100px;resize:vertical;margin:14px 0}
.controls{display:flex;justify-content:space-between;align-items:center;gap:12px}.primary{background:#327252;color:white;border-color:#327252}
button{border:1px solid #dce4de;border-radius:7px;padding:8px 12px;background:white;color:#44584b}button:hover{filter:brightness(.97)}
.label{display:block;font-weight:600}.notice{min-height:22px;font-size:13px;margin:10px 0 0;color:#3b7254}.notice.error{color:#b34640}
.history-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.muted{font-size:12px;color:#859189}
.tasks{list-style:none;padding:0;margin:0}.task{padding:16px 0;border-top:1px solid #edf0ee;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px}
.title{font-weight:600;word-break:break-word;margin:0 0 5px}.url{font-size:12px;color:#7a8780;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:#7a8780;margin-top:9px}.status{border-radius:5px;padding:3px 7px;background:#edf2ef;color:#60806b}
.status.success{background:#e9f4ed;color:#377550}.status.failed{background:#fceceb;color:#b65d55}.status.processing{background:#fff4dc;color:#9d7938}
.actions{display:flex;flex-wrap:wrap;gap:6px;align-content:center;justify-content:flex-end}.actions button{font-size:12px;padding:6px 9px}
.path{font:12px ui-monospace,monospace;display:block;overflow-wrap:anywhere;margin-top:9px;color:#617267}.error-text{color:#b65d55;margin-top:8px;font-size:12px;overflow-wrap:anywhere}
.empty{text-align:center;padding:44px 10px;color:#839188}.pager{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px}
footer{text-align:center;font-size:12px;color:#93a098;margin:20px 0}
dialog{border:1px solid #dce4de;border-radius:12px;padding:24px;max-width:calc(100vw - 28px)}dialog::backdrop{background:#20382b55}
@media(max-width:650px){main{padding:20px 14px}header{align-items:flex-start;flex-direction:column}.token{width:100%}.token input{flex:1;width:0}.card{padding:16px}.controls{align-items:stretch;flex-direction:column}.task{grid-template-columns:1fr}.actions{justify-content:flex-start}.history-header{align-items:flex-start}h1{font-size:18px}}
</style>
</head>
<body><main>
<header><div class="brand"><img src="/assets/link2obsidian-icon.png" alt=""><div><h1>纳知库 <span class="version">V0.2</span></h1><p>链接 → Markdown → Obsidian</p></div></div>
<form id="token-form" class="token"><label for="token" class="muted">API Token</label><input id="token" type="password" autocomplete="off" placeholder="启用鉴权时填写"><button type="submit">连接</button><button id="logout" type="button">清除</button></form></header>
<section class="card" aria-labelledby="create-title"><h2 id="create-title">新建采集任务</h2><p>粘贴网页链接或分享文字，正文与图片直接保存到你的 Obsidian。</p>
<form id="clip-form"><label class="label" for="url">网页链接</label><textarea id="url" required maxlength="8192" placeholder="https://… 或包含链接的分享文字"></textarea>
<div class="controls"><div><label for="policy">重复文章</label> <select id="policy"><option value="skip">跳过（默认）</option><option value="overwrite">重新抓取并覆盖</option><option value="suffix">另存新版</option></select></div><button class="primary" id="submit" type="submit">保存到 Obsidian</button></div></form>
<p id="notice" class="notice" role="status" aria-live="polite"></p></section>
<section class="card" aria-labelledby="history-title"><div class="history-header"><div><h2 id="history-title">最近任务 / 历史记录</h2><p id="count" class="muted">正在连接…</p></div><button id="refresh">刷新</button></div>
<ul id="tasks" class="tasks"></ul><div class="pager"><button id="previous">上一页</button><span id="page" class="muted">1</span><button id="next">下一页</button></div></section>
<footer>只做采集入口 · 正文保存在 Obsidian，任务元数据保存在本机</footer>
</main>
<dialog id="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">重新抓取并覆盖</h2><p>如果文章已存在，将覆盖已有笔记。是否继续？</p><div class="actions"><button id="confirm-cancel" type="button">取消</button><button id="confirm-accept" type="button" class="primary">确认覆盖</button></div></dialog>
<script>
(function(){
  var token = ''; // Kept only in memory; never placed in a URL or persistent storage.
  var offset = 0, limit = 20, total = 0, refreshing = false, timer;
  var tasks = document.getElementById('tasks');
  var shownPaths = new Set();
  async function confirmOverwrite(){
    var dialog=document.getElementById('confirm-dialog');
    return new Promise(function(resolve){
      document.getElementById('confirm-cancel').onclick=function(){dialog.close();resolve(false);};
      document.getElementById('confirm-accept').onclick=function(){dialog.close();resolve(true);};
      dialog.oncancel=function(event){event.preventDefault();dialog.close();resolve(false);};
      dialog.showModal();
    });
  }
  function notice(message, error){var el=document.getElementById('notice');el.textContent=message;el.className='notice'+(error?' error':'');}
  async function api(path, options){
    options=options||{};options.headers=Object.assign({'Content-Type':'application/json'},options.headers||{});
    if(token) options.headers.Authorization='Bearer '+token;
    var response=await fetch(path,options);
    var data=await response.json();
    if(!response.ok) throw new Error(data.message||'请求失败');
    return data;
  }
  function element(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function action(label,callback){var button=element('button','',label);button.type='button';button.onclick=async function(){button.disabled=true;try{await callback();}catch(error){notice(error.message,true);}finally{button.disabled=false;}};return button;}
  function render(items){
    tasks.replaceChildren();
    if(!items.length){tasks.appendChild(element('li','empty','暂无任务，粘贴第一个链接开始采集。'));return;}
    items.forEach(function(task){
      var row=element('li','task'),content=element('div'),actions=element('div','actions');
      content.appendChild(element('div','title',task.title||task.url));
      content.appendChild(element('span','url',task.url));
      var meta=element('div','meta');
      var labels={queued:'等待中',processing:'处理中',success:'成功',failed:'失败'};
      meta.appendChild(element('span','status '+task.status,labels[task.status]||task.status));
      if(task.result && task.result.status==='duplicate')meta.appendChild(element('span','','已存在 · 已跳过'));
      if(task.category)meta.appendChild(element('span','',task.category));
      if(task.result && task.result.plugin)meta.appendChild(element('span','',task.result.plugin));
      if(task.result && task.result.images)meta.appendChild(element('span','','图片 '+task.result.images.downloaded+' 张'+(task.result.images.failed?' · '+task.result.images.failed+' 张失败':'')));
      meta.appendChild(element('time','',new Date(task.createdAt).toLocaleString()));
      content.appendChild(meta);
      if(task.error)content.appendChild(element('div','error-text',task.error));
      if(task.file){
        var path=element('code','path',task.file);path.hidden=!shownPaths.has(task.id);content.appendChild(path);
        actions.appendChild(action('查看路径',function(){path.hidden=!path.hidden;if(path.hidden)shownPaths.delete(task.id);else shownPaths.add(task.id);}));
        actions.appendChild(action('复制路径',async function(){
          if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(task.file);notice('已复制 Obsidian 文件路径');}
          else{shownPaths.add(task.id);path.hidden=false;notice('当前浏览器无法自动复制，请选中显示的路径复制。');}
        }));
      }
      if(task.status==='failed')actions.appendChild(action('重试',async function(){await retry(task,task.policy);}));
      if(task.status==='success')actions.appendChild(action('重新抓取',async function(){await retry(task,'overwrite');}));
      row.appendChild(content);row.appendChild(actions);tasks.appendChild(row);
    });
  }
  async function retry(task,policy){
    if(policy==='overwrite' && !await confirmOverwrite())return;
    await api('/api/tasks/'+encodeURIComponent(task.id)+'/retry',{method:'POST',body:JSON.stringify({policy:policy})});
    offset=0;notice('任务已加入队列');await refresh();
  }
  async function refresh(){
    if(refreshing)return;refreshing=true;
    try{
      var data=await api('/api/tasks?limit='+limit+'&offset='+offset);
      total=data.total;render(data.tasks);
      if(document.getElementById('notice').textContent==='正在连接…')notice('已连接');
      document.getElementById('count').textContent='共 '+total+' 个任务 · 每 3 秒自动更新';
      document.getElementById('page').textContent=String(Math.floor(offset/limit)+1);
      document.getElementById('previous').disabled=offset===0;
      document.getElementById('next').disabled=offset+limit>=total;
    }catch(error){notice(error.message,true);document.getElementById('count').textContent='连接失败，请检查 API Token';}
    finally{refreshing=false;clearTimeout(timer);timer=setTimeout(refresh,3000);}
  }
  document.getElementById('clip-form').onsubmit=async function(event){
    event.preventDefault();var button=document.getElementById('submit');button.disabled=true;
    try{
      var policy=document.getElementById('policy').value;
      if(policy==='overwrite' && !await confirmOverwrite())return;
      await api('/api/tasks',{method:'POST',body:JSON.stringify({url:document.getElementById('url').value,policy:policy})});
      document.getElementById('url').value='';offset=0;notice('任务已加入队列，可在下方查看进度');await refresh();
    }catch(error){notice(error.message,true);}finally{button.disabled=false;}
  };
  document.getElementById('token-form').onsubmit=function(event){event.preventDefault();token=document.getElementById('token').value.trim();document.getElementById('token').value='';notice('正在连接…');refresh();};
  document.getElementById('logout').onclick=function(){token='';document.getElementById('token').value='';tasks.replaceChildren();notice('已清除 Token');refresh();};
  document.getElementById('refresh').onclick=refresh;
  document.getElementById('previous').onclick=function(){offset=Math.max(0,offset-limit);refresh();};
  document.getElementById('next').onclick=function(){offset+=limit;refresh();};
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
  refresh();
})();
</script></body></html>`;
}
