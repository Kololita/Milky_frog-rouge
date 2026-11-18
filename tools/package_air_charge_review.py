"""Assemble native pose renders with the same phase durations as the web demo."""
from pathlib import Path
from math import sqrt
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
renders=root/'output/animations/special-attacks-review'
fall=sqrt((.39*1.55)*2/28)
def runtime(frame):
    source=(frame-1)/24
    if source<=.22:return .5*source/.22
    if source<=.5:return .5+(source-.22)/.28*fall
    return .5+fall+.2+(source-.5)

frames=list(range(1,44,2))
images=[];durations=[]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
for i,frame in enumerate(frames):
    panel=Image.new('RGB',(720,495),'#f0f3f5')
    for column,view in enumerate(['front','side']):
        panel.paste(Image.open(renders/f'AirAttack-{view}-{frame:02}.png').convert('RGB'),(column*360,35))
    source=(frame-1)/24
    phase='CHARGE: rise, drift, raise fists' if source<.22 else 'SLAM' if source<.5 else 'IMPACT: 0.2s' if source==.5 else 'BACKFLIP / RECOVER'
    ImageDraw.Draw(panel).text((12,8),phase,font=font,fill='#253d39')
    images.append(panel)
    durations.append(round(1000*(runtime(frames[i+1])-runtime(frame))) if i+1<len(frames) else 600)
images[0].save(root/'output/animations/AirAttack.gif',save_all=True,append_images=images[1:],duration=durations,loop=0,optimize=False)

chosen=[1,3,5,7,13,25,31,43]
sheet=Image.new('RGB',(8*220,2*310),'#f0f3f5');draw=ImageDraw.Draw(sheet)
for row,view in enumerate(['front','side']):
    for column,frame in enumerate(chosen):
        image=Image.open(renders/f'AirAttack-{view}-{frame:02}.png').convert('RGB');image.thumbnail((220,280))
        sheet.paste(image,(column*220,row*310+28))
        draw.text((column*220+9,row*310+6),f'{view} / {runtime(frame):.2f}s',font=font,fill='#253d39')
sheet.save(root/'docs/air-charge-review.jpg',quality=91)
print('AIR_CHARGE_REVIEW_PACKAGED',sum(durations),'ms including the end preview pause')
