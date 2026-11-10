import fitz, os, math
from PIL import Image, ImageDraw
path='attached_assets/Platform_Digital_PUB_ASPEKINDO_1789014599983.pdf'
outdir='.agents/outputs/platform-presentation'
os.makedirs(outdir, exist_ok=True)
doc=fitz.open(path)
print('pages=', doc.page_count, 'metadata=', doc.metadata)
texts=[]
thumbs=[]
for i,page in enumerate(doc):
    texts.append(f'\n--- PAGE {i+1} ---\n'+page.get_text())
    pix=page.get_pixmap(matrix=fitz.Matrix(1.1,1.1), alpha=False)
    p=os.path.join(outdir,f'page-{i+1:02d}.png')
    pix.save(p)
    img=Image.open(p).convert('RGB')
    img.thumbnail((360,220))
    canvas=Image.new('RGB',(380,260),'white')
    canvas.paste(img,((380-img.width)//2,25))
    ImageDraw.Draw(canvas).text((12,6),f'Slide {i+1}',fill='black')
    thumbs.append(canvas)
open('/tmp/platform-presentation.txt','w').write(''.join(texts))
cols=3; rows=math.ceil(len(thumbs)/cols)
sheet=Image.new('RGB',(cols*380,rows*260),(225,225,225))
for i,img in enumerate(thumbs): sheet.paste(img,((i%cols)*380,(i//cols)*260))
sheet.save(os.path.join(outdir,'contact-sheet.png'))
print('wrote text chars=',sum(map(len,texts)),'contact sheet=',os.path.join(outdir,'contact-sheet.png'))
