from pathlib import Path
p=Path('admin/dashboard.html')
s=p.read_text()
old='<nav class="nav"><button data-section="overview">Overview</button><button data-section="redeem">Redeem Codes</button><button data-section="football">Football Centre</button><button data-section="media">Media Library</button></nav>'
new=old.replace('</nav>','<a class="nav-external" href="/admin/calculators.html">Calculator Data</a></nav>')
if 'href="/admin/calculators.html"' not in s and old in s:
    s=s.replace(old,new,1)
css='.nav-external{display:block;padding:12px 12px 12px 42px;border:1px solid transparent;border-radius:12px;color:#7d8883;font-weight:700;font-size:10px;text-decoration:none;position:relative}.nav-external:before{content:"05";position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#606b66;font:700 9px var(--mono)}.nav-external:hover{background:#ffffff05;color:#edf1ed;border-color:#ffffff0b}'
if '.nav-external{' not in s:
    s=s.replace('</style>',css+'</style>',1)
p.write_text(s)
